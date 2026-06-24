import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import RootNavigator, { navigationRef } from './src/navigation/RootNavigator';
import { useSession } from './src/auth/useSession';
import { startAuthLinkListener } from './src/auth/deepLink';
import { ProfileGateProvider } from './src/auth/profileGate';
import { getMyProfile } from './src/storage/profile';
import {
  onNotificationTap,
  setupPushNotifications,
} from './src/notifications/setup';
import {
  configurePurchases,
  identifyPurchases,
  resetPurchases,
} from './src/lib/purchases';
import {
  setAnalyticsOptedIn,
  resetAnalytics,
  track,
} from './src/lib/analytics';
import { colors } from './src/theme';
import UpdateOverlay from './src/components/UpdateOverlay';
import { DialogHost } from './src/components/AppDialog';
import {
  getDiscoverablePref,
  startBackgroundPresence,
  foregroundCheckin,
} from './src/location/backgroundPresence';

// Crash reporting. Privacy notes:
// - sendDefaultPii: false → no IP, no cookies, no auto-captured user info
// - HttpClient breadcrumbs disabled → no message bodies leak via fetch breadcrumbs
// - beforeSend scrubs Authorization headers and any string that looks like a
//   Supabase JWT or push token, defense-in-depth.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: Updates.channel ?? (__DEV__ ? 'development' : 'unknown'),
  sendDefaultPii: false,
  enableAutoSessionTracking: true,
  // Drop default Http breadcrumb integration — captures fetch/XHR bodies.
  integrations: (defaults) =>
    defaults.filter((i) => i.name !== 'Http' && i.name !== 'HttpClient'),
  beforeSend(event) {
    // Strip any user identifier Sentry might have attached.
    if (event.user) event.user = undefined;
    // Scrub request headers (Authorization, apikey, etc.) just in case.
    if (event.request?.headers) {
      event.request.headers = {};
    }
    return event;
  },
  beforeBreadcrumb(crumb) {
    // Belt-and-suspenders: even with Http integration disabled, blank out
    // any breadcrumb data field that might carry payloads.
    if (crumb.data && typeof crumb.data === 'object') {
      const cleaned = { ...crumb.data } as Record<string, unknown>;
      delete cleaned.body;
      delete cleaned.response;
      delete cleaned.request;
      crumb.data = cleaned;
    }
    return crumb;
  },
});

function App() {
  const { session, loaded: sessionLoaded } = useSession();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    return startAuthLinkListener();
  }, []);

  // Configure RevenueCat once at startup (no-op until the API key is set).
  useEffect(() => {
    configurePurchases();
  }, []);

  // Tie purchases to the signed-in user (and detach on sign-out).
  useEffect(() => {
    if (session) identifyPurchases(session.user.id);
    else resetPurchases();
  }, [session]);

  // On cold launch, pull the latest OTA update and reload into it so testers
  // always run the newest JS without waiting a launch behind. No-ops in dev
  // (Metro serves the bundle) and stays silent if offline or up to date.
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdating(true);
          // Hold the overlay for a minimum beat so the update is actually
          // perceptible, even when the download is near-instant. If the
          // download takes longer, Promise.all simply waits for it.
          await Promise.all([
            Updates.fetchUpdateAsync(),
            new Promise((resolve) => setTimeout(resolve, 2500)),
          ]);
          await Updates.reloadAsync();
        }
      } catch {
        // Offline / fetch failed — drop the overlay and run the cached bundle.
        setUpdating(false);
      }
    })();
  }, []);

  // Register push token once we know who the user is.
  useEffect(() => {
    if (session) setupPushNotifications().catch(() => {});
  }, [session]);

  // If the user opted into Discoverable, make sure the background presence task
  // is running after a cold launch — Android can kill the foreground service,
  // and we want the opt-in to be sticky. No-ops if permission was revoked.
  useEffect(() => {
    if (!session) return;
    getDiscoverablePref().then((on) => {
      if (on) startBackgroundPresence().catch(() => {});
    });
  }, [session]);

  // Refresh presence + advance the venue dwell whenever the app comes to the
  // foreground. Belt-and-suspenders with the background heartbeat: even if
  // Android throttled background pings while the phone sat idle, opening the app
  // re-checks you in immediately, so your spot and dwell are always current
  // during active use.
  useEffect(() => {
    if (!session) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      getDiscoverablePref().then((on) => {
        if (on) foregroundCheckin().catch(() => {});
      });
    });
    return () => sub.remove();
  }, [session]);

  // Tap on a notification → navigate to the relevant Chat thread.
  useEffect(() => {
    return onNotificationTap((data) => {
      const threadId = typeof data?.threadId === 'string' ? data.threadId : null;
      if (threadId && navigationRef.isReady()) {
        navigationRef.navigate('Chat', { threadId });
      }
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setHasProfile(null);
      resetAnalytics();
      return;
    }
    try {
      const p = await getMyProfile();
      setHasProfile(!!p);
      // Sync PostHog opt-in state with the user's preference. Analytics stay
      // anonymous/device-scoped on purpose: we do NOT identify() with the raw
      // Supabase user_id, which would be an external re-identification join key
      // (PRIVACY.md rule 7). Events are aggregate counts, so per-user identity
      // isn't needed.
      if (p?.analyticsOptedIn) {
        await setAnalyticsOptedIn(true);
        track('app_open');
      } else {
        await setAnalyticsOptedIn(false);
      }
    } catch {
      setHasProfile(false);
    }
  }, [session]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const gate = useMemo(() => ({ refreshProfile }), [refreshProfile]);

  const ready = sessionLoaded && (!session || hasProfile !== null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardProvider>
          <StatusBar style="light" />
          {ready ? (
            <ProfileGateProvider value={gate}>
              <RootNavigator
                isAuthed={!!session}
                hasProfile={!!session && hasProfile === true}
              />
            </ProfileGateProvider>
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.background }} />
          )}
          {updating && <UpdateOverlay />}
          <DialogHost />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
