import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
  setAnalyticsOptedIn,
  resetAnalytics,
  track,
} from './src/lib/analytics';
import { colors } from './src/theme';

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

  useEffect(() => {
    return startAuthLinkListener();
  }, []);

  // Register push token once we know who the user is.
  useEffect(() => {
    if (session) setupPushNotifications().catch(() => {});
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
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
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
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
