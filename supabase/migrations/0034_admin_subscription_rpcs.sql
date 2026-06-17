-- Admin RPCs for supporter subscriptions (anor-admin web UI). Same security
-- model as 0025: the admin uses their normal account JWT, every function is
-- SECURITY DEFINER but gated by is_admin(), writes are audit-logged, and
-- execute is granted only to authenticated.
--
-- Normal subscription rows come from the billing webhook (service_role).
-- These RPCs are for: (a) comping a tier (support fixes, giveaways, a friend),
-- and crucially (b) granting yourself a tier to test the cosmetic flow before
-- RevenueCat is wired. Comps have store = null to distinguish them from paid
-- subs.

-- ── Write: grant / comp a tier ───────────────────────────────────────
create or replace function admin_grant_subscription(
  p_user_id uuid,
  p_tier text,
  p_months int default 1,
  p_founding boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  if p_tier not in ('supporter','patron','benefactor') then
    raise exception 'Invalid tier: %', p_tier;
  end if;
  if p_months < 1 then
    raise exception 'Months must be at least 1';
  end if;

  insert into subscriptions (
    user_id, tier, status, current_period_end, is_founding, store, updated_at
  )
  values (
    p_user_id, p_tier, 'active',
    now() + (p_months || ' months')::interval,
    p_founding, null, now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    status = 'active',
    current_period_end = excluded.current_period_end,
    is_founding = subscriptions.is_founding or excluded.is_founding,
    updated_at = now();

  insert into audit_log (actor_id, action, target_id, details)
  values (
    auth.uid(), 'admin_grant_subscription', p_user_id,
    jsonb_build_object('tier', p_tier, 'months', p_months, 'founding', p_founding)
  );
end $$;

revoke execute on function admin_grant_subscription(uuid, text, int, boolean) from anon, public;
grant execute on function admin_grant_subscription(uuid, text, int, boolean) to authenticated;

-- ── Write: revoke a comp (mark expired immediately) ──────────────────
create or replace function admin_revoke_subscription(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;

  update subscriptions
  set status = 'expired', current_period_end = now(), updated_at = now()
  where user_id = p_user_id;

  insert into audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'admin_revoke_subscription', p_user_id, '{}'::jsonb);
end $$;

revoke execute on function admin_revoke_subscription(uuid) from anon, public;
grant execute on function admin_revoke_subscription(uuid) to authenticated;

-- ── Read: list subscribers (newest first) ────────────────────────────
create or replace function admin_list_subscriptions()
returns table (
  user_id uuid,
  name text,
  tier text,
  status text,
  current_period_end timestamptz,
  is_founding boolean,
  store text,
  is_comp boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  return query
  select
    s.user_id, p.name, s.tier, s.status, s.current_period_end,
    s.is_founding, s.store, (s.store is null) as is_comp, s.created_at
  from subscriptions s
  join profiles p on p.id = s.user_id
  order by s.created_at desc
  limit 500;
end $$;

revoke execute on function admin_list_subscriptions() from anon, public;
grant execute on function admin_list_subscriptions() to authenticated;
