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
import type { PostHogEventProperties } from '@posthog/core';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = 'https://us.i.posthog.com';

// The opt-in lives in the DB profile, but the headless background-presence task
// runs without the React tree, so it can't read that. Mirror the flag to
// AsyncStorage so the task can honor it too (see initAnalyticsFromPersistedOptIn).
const OPTIN_KEY = 'anor.analytics.optedin';

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
  // Persist the choice so the headless task can honor it (best-effort).
  try {
    await AsyncStorage.setItem(OPTIN_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
  if (value) {
    if (!KEY) return;
    if (!client) {
      try {
        client = new PostHog(KEY, {
          host: HOST,
          captureAppLifecycleEvents: false,
          flushAt: 10,
          flushInterval: 30_000,
        });
      } catch {
        return;
      }
    }
    await client.optIn().catch(() => {});
  } else if (client) {
    await client.optOut();
  }
}

/**
 * Fire a named event. No-op if the user is opted out or the SDK isn't
 * initialized. Properties should be small, primitive, and PII-free.
 */
export function track(event: string, props?: PostHogEventProperties): void {
  if (!client) return;
  client.capture(event, props);
}

/**
 * Honor the persisted opt-in in a headless context. The background-presence
 * TaskManager task runs the JS entry WITHOUT rendering App, so the React-tree
 * call to setAnalyticsOptedIn never happens and the client stays null — silently
 * dropping every track() call from the background. Call this at the top of the
 * headless task so its events are actually captured. Emits nothing for opted-out
 * users: it only instantiates the client when the persisted flag is set.
 */
export async function initAnalyticsFromPersistedOptIn(): Promise<void> {
  if (client) return; // already live (foreground, or a prior call)
  let optedIn = false;
  try {
    optedIn = (await AsyncStorage.getItem(OPTIN_KEY)) === '1';
  } catch {
    // ignore — default to no analytics
  }
  if (optedIn) await setAnalyticsOptedIn(true);
}

/**
 * Force-send queued events. PostHog batches, so a headless task that captures an
 * event and then exits would lose it when the JS context is torn down — flush
 * before the task returns. No-op when not initialized.
 */
export async function flushAnalytics(): Promise<void> {
  if (!client) return;
  try {
    await client.flush();
  } catch {
    // best-effort
  }
}

/**
 * Forget the current user. Call on sign-out to break the link between
 * the device and the previous account.
 */
export function resetAnalytics(): void {
  if (!client) return;
  client.reset();
}
