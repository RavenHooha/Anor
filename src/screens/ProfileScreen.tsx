import { useCallback, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import InterestChips from '../components/InterestChips';
import { getMyProfile, type Profile } from '../storage/profile';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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
});
