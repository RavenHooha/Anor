// Privacy-respecting analytics wrapper around posthog-react-native.
//
// Hard rules enforced here:
// 1. PostHog is NEVER initialized for opted-out users — opted-out users
//    don't even download the SDK config. Stronger than init + suppress.
// 2. All capture is explicit — no app-lifecycle auto-tracking, no
//    autocapture, no screen views. Only events we deliberately fire.
// 3. Event names are stable, well-known strings — no dynamic event names
//    with user content embedded. Property values should not contain PII.
//
// See PRIVACY.md and PRIVACY_POLICY.md for the broader contract.

import PostHog from 'posthog-react-native';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = 'https://us.i.posthog.com';

// eslint-disable-next-line no-console
console.log('[analytics] module loaded; KEY present:', !!KEY, 'prefix:', KEY?.slice(0, 8));

let client: PostHog | null = null;

/**
 * Toggle the user's analytics participation. Call this when the profile's
 * `analyticsOptedIn` flag is known (on app start) and whenever the user
 * flips the Settings toggle.
 *
 * Pass `true` to lazily instantiate the SDK and start capturing.
 * Pass `false` to stop capturing; existing events that haven't been
 * flushed yet will not be sent.
 */
export async function setAnalyticsOptedIn(value: boolean): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[analytics] setAnalyticsOptedIn called:', value, 'client exists:', !!client);
  if (value) {
    if (!KEY) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] EXPO_PUBLIC_POSTHOG_KEY missing — opt-in is no-op');
      return;
    }
    if (!client) {
      try {
        client = new PostHog(KEY, {
          host: HOST,
          captureAppLifecycleEvents: false,
          flushAt: 10,
          flushInterval: 30_000,
        });
        // eslint-disable-next-line no-console
        console.log('[analytics] PostHog client instantiated');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[analytics] PostHog init failed:', e);
        return;
      }
    }
    try {
      await client.optIn();
      // eslint-disable-next-line no-console
      console.log('[analytics] optIn complete');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[analytics] optIn failed:', e);
    }
  } else if (client) {
    await client.optOut();
  }
}

/**
 * Fire a named event. No-op if the user is opted out or the SDK isn't
 * initialized. Properties should be small, primitive, and PII-free.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log('[analytics] track:', event, 'client:', !!client);
  if (!client) return;
  client.capture(event, props);
}

/**
 * Link subsequent events to a stable user identifier. Call once per
 * sign-in after opt-in is confirmed.
 */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!client) return;
  client.identify(userId, traits);
}

/**
 * Forget the current user. Call on sign-out to break the link between
 * the device and the previous account.
 */
export function resetAnalytics(): void {
  if (!client) return;
  client.reset();
}
