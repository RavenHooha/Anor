import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import InterestChips from '../components/InterestChips';
import {
  getMyProfile,
  setHideMessagePreview,
  setAnalyticsOptedIn,
  deleteMyAccount,
  type Profile,
} from '../storage/profile';
import { supabase } from '../lib/supabase';
import { TOS_URL, PRIVACY_POLICY_URL, supportMailto } from '../lib/links';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [savingAnalytics, setSavingAnalytics] = useState(false);
  const navigation = useNavigation<Nav>();

  useFocusEffect(
    useCallback(() => {
      getMyProfile().then((p) => {
        setProfile(p);
        setLoaded(true);
      });
    }, []),
  );

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut().catch(() => {});
    // App.tsx auth gate will react to the session change and reroute to AuthScreen.
  };

  const onTogglePreview = async (next: boolean) => {
    if (!profile || savingPreview) return;
    setSavingPreview(true);
    // Optimistic — flip locally, revert on error
    setProfile({ ...profile, hideMessagePreview: next });
    try {
      await setHideMessagePreview(next);
    } catch (e) {
      setProfile({ ...profile, hideMessagePreview: !next });
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
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
    } catch (e) {
      setProfile({ ...profile, analyticsOptedIn: !next });
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSavingAnalytics(false);
    }
  };

  const onDeleteAccount = () => {
    Alert.alert(
      'Delete your Anor account?',
      'This permanently removes your profile, photos, messages, blocks, and check-ins. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
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
                      Alert.alert(
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

  if (!loaded) {
    return <SafeAreaView style={styles.safe} edges={['top']} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>You</Text>

        <View style={styles.avatarFrame}>
          {profile?.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarEmpty} />
          )}
        </View>

        <Text style={styles.name}>{profile?.name ?? 'Unnamed'}</Text>

        {profile?.bio && profile.bio.length > 0 && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}

        {profile && profile.interests.length > 0 && (
          <InterestChips interests={profile.interests} align="center" />
        )}

        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          style={({ pressed }) => [
            styles.editBtn,
            pressed && styles.editBtnPressed,
          ]}
        >
          <Ionicons name="pencil-outline" size={16} color={colors.secondary} />
          <Text style={styles.editLabel}>Edit profile</Text>
        </Pressable>

        <View style={styles.spacer} />

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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  title: { ...typography.display, color: colors.secondary },
  avatarFrame: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  avatar: { width: '100%', height: '100%' },
  avatarEmpty: { flex: 1 },
  name: {
    ...typography.title,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  bio: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  spacer: { flex: 1 },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  signOutPressed: { borderColor: colors.textMuted },
  signOutLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: '500' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  editBtnPressed: { backgroundColor: colors.surfaceElevated },
  editLabel: { color: colors.secondary, fontSize: 14, fontWeight: '600' },
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
