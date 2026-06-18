// RevenueCat → Supabase webhook. Keeps the `subscriptions` table in sync with
// RevenueCat (the billing source of truth). Runs as an Edge Function with the
// service role, so it can write rows that clients never can.
//
// Setup:
//   1. supabase functions deploy revenuecat-webhook --no-verify-jwt
//   2. supabase secrets set REVENUECAT_WEBHOOK_SECRET=<a long random string>
//   3. In RevenueCat → Integrations → Webhooks, set the URL to this function
//      and the Authorization header to the same secret.
//
// We rely on the app calling Purchases.logIn(<supabase user id>), so the
// event's app_user_id IS our profiles/auth user id.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supporters who first subscribe before this date keep "Founding Supporter".
const FOUNDING_CUTOFF_MS = Date.parse('2027-06-30T23:59:59Z');

type Tier = 'supporter' | 'patron' | 'benefactor';

function tierFromProductId(id: string | undefined): Tier | null {
  const s = (id ?? '').toLowerCase();
  if (s.includes('benefactor')) return 'benefactor';
  if (s.includes('patron')) return 'patron';
  if (s.includes('supporter')) return 'supporter';
  return null;
}

Deno.serve(async (req) => {
  // Verify the shared secret RevenueCat sends in the Authorization header.
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || req.headers.get('Authorization') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const event = body.event ?? {};
  const type = String(event.type ?? '');
  const userId = String(event.app_user_id ?? '');
  if (!userId) return new Response('No app_user_id', { status: 200 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Events that GRANT or extend access.
  const GRANTS = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
    'NON_RENEWING_PURCHASE',
  ]);

  if (GRANTS.has(type)) {
    const tier = tierFromProductId(event.product_id as string | undefined);
    if (!tier) return new Response('Unknown product', { status: 200 });

    const periodEndMs = Number(event.expiration_at_ms ?? 0);
    const periodEnd = periodEndMs
      ? new Date(periodEndMs).toISOString()
      : new Date(Date.now() + 31 * 86400_000).toISOString();

    const eventMs = Number(event.event_timestamp_ms ?? Date.now());
    const isFounding = eventMs <= FOUNDING_CUTOFF_MS;

    // Preserve an existing founding flag across renewals/upgrades.
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('is_founding')
      .eq('user_id', userId)
      .maybeSingle();

    const { error } = await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        tier,
        status: 'active',
        current_period_end: periodEnd,
        is_founding: existing?.is_founding === true || isFounding,
        store: 'play',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) return new Response(error.message, { status: 500 });
    return new Response('ok', { status: 200 });
  }

  // Access ENDS (auto-renew off is NOT this — that's CANCELLATION, where access
  // continues until the period expires, so we ignore it and wait for EXPIRATION).
  if (type === 'EXPIRATION') {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) return new Response(error.message, { status: 500 });
    return new Response('ok', { status: 200 });
  }

  // Everything else (CANCELLATION, BILLING_ISSUE, TEST, etc.) — acknowledge.
  return new Response('ignored', { status: 200 });
});
