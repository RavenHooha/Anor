import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { useSession } from './src/auth/useSession';
import { startAuthLinkListener } from './src/auth/deepLink';
import { ProfileGateProvider } from './src/auth/profileGate';
import { getMyProfile } from './src/storage/profile';
import { colors } from './src/theme';

export default function App() {
  const { session, loaded: sessionLoaded } = useSession();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    return startAuthLinkListener();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setHasProfile(null);
      return;
    }
    try {
      const p = await getMyProfile();
      setHasProfile(!!p);
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
