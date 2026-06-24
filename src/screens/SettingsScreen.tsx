import { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Linking,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import { showDialog } from '../components/AppDialog';
import {
  getMyProfile,
  setHideMessagePreview,
  setAnalyticsOptedIn,
  deleteMyAccount,
  exportMyData,
  type Profile,
} from '../storage/profile';
import { setAnalyticsOptedIn as setAnalyticsOptedInClient, track } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { TOS_URL, PRIVACY_POLICY_URL, supportMailto } from '../lib/links';
import {
  startBackgroundPresence,
  stopBackgroundPresence,
  getBgBreadcrumb,
  getLastBgRun,
  getDiscoverablePref,
  setDiscoverablePref,
  foregroundCheckin,
  type BgBreadcrumb,
  type LastBgRun,
} from '../location/backgroundPresence';
import { getBleBackgroundPref, setBleBackgroundPref } from '../ble/backgroundPref';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default function SettingsScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [savingAnalytics, setSavingAnalytics] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [discoverable, setDiscoverable] = useState(false);
  const [savingDiscoverable, setSavingDiscoverable] = useState(false);
  const [bleBackground, setBleBackground] = useState(false);
  const [savingBleBackground, setSavingBleBackground] = useState(false);
  const [crumb, setCrumb] = useState<BgBreadcrumb | null>(null);
  const [lastBg, setLastBg] = useState<LastBgRun | null>(null);
  const [checking, setChecking] = useState(false);
  const [, forceTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigation = useNavigation<Nav>();

  const onCheckNow = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const next = await foregroundCheckin();
      setCrumb(next);
    } finally {
      setChecking(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      getMyProfile().then(setProfile);
      getDiscoverablePref().then(setDiscoverable);
      getBleBackgroundPref().then(setBleBackground);

      // Live, read-only poll so the breadcrumb + last-background-ping reflect
      // reality without tapping (tapping would mutate the very thing we watch).
      const refresh = () => {
        getBgBreadcrumb().then(setCrumb);
        getLastBgRun().then(setLastBg);
        forceTick((n) => n + 1); // re-render so "Nm ago" stays current
      };
      refresh();
      pollRef.current = setInterval(refresh, 3_000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, []),
  );

  const onToggleDiscoverable = async (next: boolean) => {
    if (savingDiscoverable) return;
    setSavingDiscoverable(true);
    setDiscoverable(next);
    await setDiscoverablePref(next);
    try {
      if (next) {
        const err = await startBackgroundPresence();
        if (err) {
          setDiscoverable(false);
          await setDiscoverablePref(false);
          showDialog('Could not turn on', err);
        }
      } else {
        await stopBackgroundPresence();
      }
    } catch (e) {
      setDiscoverable(!next);
      await setDiscoverablePref(!next);
      showDialog('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSavingDiscoverable(false);
      getBgBreadcrumb().then(setCrumb);
    }
  };

  const onToggleBleBackground = async (next: boolean) => {
    if (savingBleBackground) return;
    setSavingBleBackground(true);
    setBleBackground(next);
    try {
      await setBleBackgroundPref(next);
      track('ble_background_toggled', { on: next });
    } catch {
      setBleBackground(!next);
    } finally {
      setSavingBleBackground(false);
    }
  };

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut().catch(() => {});
    // App.tsx auth gate reroutes to AuthScreen on session change.
  };

  const onTogglePreview = async (next: boolean) => {
    if (!profile || savingPreview) return;
    setSavingPreview(true);
    setProfile({ ...profile, hideMessagePreview: next });
    try {
      await setHideMessagePreview(next);
    } catch (e) {
      setProfile({ ...profile, hideMessagePreview: !next });
      showDialog('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSavingPreview(false);
    }
  };

  const onToggleAnalytics = async (next: boolean) => {
    if (!profile || savingAnalytics) return;
    setSavingAnalytics(true);
    setProfile({ ...profile, analyticsOptedIn: next });
    try {
      await setAnalyticsOptedIn(next);
      await setAnalyticsOptedInClient(next);
    } catch (e) {
      setProfile({ ...profile, analyticsOptedIn: !next });
      showDialog('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSavingAnalytics(false);
    }
  };

  const onExportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportMyData();
      await Share.share({
        message: JSON.stringify(data, null, 2),
        title: 'Anor data export',
      });
    } catch (e) {
      showDialog('Export failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setExporting(false);
    }
  };

  const onDeleteAccount = () => {
    showDialog(
      'Delete your Anor account?',
      'This permanently removes your profile, photos, messages, blocks, and check-ins. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            showDialog(
              'Really delete?',
              'Last chance — there is no recovery after this.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteMyAccount();
                      await supabase.auth.signOut().catch(() => {});
                    } catch (e) {
                      showDialog(
                        'Delete failed',
                        e instanceof Error ? e.message : 'Try again.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {profile?.isMaker && (
          <>
            <Text style={styles.sectionLabel}>Maker</Text>
            <Pressable
              onPress={() => navigation.navigate('Maker')}
              accessibilityRole="button"
              accessibilityLabel="Message anyone as the maker"
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.linkLabel}>Message anyone</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </>
        )}

        <Text style={styles.sectionLabel}>Discoverable (beta)</Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.linkLabel}>Let nearby people find me</Text>
            <Text style={styles.toggleHint}>
              Keeps your spot fresh in the background so people at the same venue
              can see you're open to connect. Off by default.
            </Text>
          </View>
          <Switch
            value={discoverable}
            onValueChange={onToggleDiscoverable}
            disabled={savingDiscoverable}
            trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
            thumbColor={colors.textPrimary}
          />
        </View>

        {(crumb || discoverable) && (
          <Pressable onPress={onCheckNow} style={styles.crumbRow}>
            {crumb ? (
              <>
                <Text
                  style={[
                    styles.crumbText,
                    { color: crumb.ok ? colors.primary : colors.secondary },
                  ]}
                >
                  {crumb.ok ? '✓' : '✕'} run #{crumb.count} ({crumb.source}) ·{' '}
                  {timeAgo(crumb.at)}
                </Text>
                <Text style={styles.crumbDetail}>{crumb.msg}</Text>
              </>
            ) : (
              <Text style={styles.crumbDetail}>No check-in yet.</Text>
            )}
            <Text style={styles.crumbBg}>
              {lastBg
                ? `background pings: ${lastBg.count} · last ${timeAgo(lastBg.at)}`
                : 'background pings: none yet'}
            </Text>
            <Text style={styles.crumbHint}>
              {checking ? 'checking…' : 'tap to check in now'}
            </Text>
          </Pressable>
        )}

        {Platform.OS === 'android' && (
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.linkLabel}>Bluetooth proximity (beta)</Text>
              <Text style={styles.toggleHint}>
                Spot people in the same room over Bluetooth, even while Anor is in
                the background. Android-only and experimental — it uses extra
                battery and won't catch everyone. Works best with “Let nearby
                people find me” on.
              </Text>
            </View>
            <Switch
              value={bleBackground}
              onValueChange={onToggleBleBackground}
              disabled={savingBleBackground}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>
        )}

        <Text style={styles.sectionLabel}>Safety</Text>

        <Pressable
          onPress={() => navigation.navigate('BlockedUsers')}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkLabel}>Manage blocked users</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.linkLabel}>Hide message previews</Text>
            <Text style={styles.toggleHint}>
              Notifications show "You have a new message" instead of the sender and text.
            </Text>
          </View>
          <Switch
            value={profile?.hideMessagePreview ?? false}
            onValueChange={onTogglePreview}
            disabled={savingPreview || !profile}
            trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
            thumbColor={colors.textPrimary}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.linkLabel}>Help improve Anor</Text>
            <Text style={styles.toggleHint}>
              Share your venue check-ins anonymously so we can show useful trends
              (no one ever sees your individual movements). Off by default.
            </Text>
          </View>
          <Switch
            value={profile?.analyticsOptedIn ?? false}
            onValueChange={onToggleAnalytics}
            disabled={savingAnalytics || !profile}
            trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
            thumbColor={colors.textPrimary}
          />
        </View>

        <Text style={styles.sectionLabel}>About</Text>

        <Pressable
          onPress={() => Linking.openURL(supportMailto())}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkLabel}>Contact support</Text>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL(TOS_URL)}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkLabel}>Terms of use</Text>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkLabel}>Privacy policy</Text>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>

        {/* ODbL attribution for OSM-sourced venue data (required). */}
        <Pressable
          onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkLabel}>Map data © OpenStreetMap</Text>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={onExportData}
          disabled={exporting}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && !exporting && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.linkLabel}>
            {exporting ? 'Preparing…' : 'Download my data'}
          </Text>
          <Ionicons name="download-outline" size={16} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.sectionLabel}>Account</Text>

        <Pressable
          onPress={onSignOut}
          disabled={signingOut}
          style={({ pressed }) => [
            styles.signOutBtn,
            pressed && !signingOut && styles.signOutPressed,
          ]}
        >
          <Text style={styles.signOutLabel}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onDeleteAccount}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.deleteLabel}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkLabel: { ...typography.body, color: colors.textSecondary },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleHint: { ...typography.caption, color: colors.textMuted },
  crumbRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 2,
  },
  crumbText: { ...typography.caption, fontWeight: '600' },
  crumbDetail: { ...typography.caption, color: colors.textSecondary },
  crumbBg: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  crumbHint: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  signOutPressed: { borderColor: colors.textMuted },
  signOutLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: '500' },
  deleteBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
