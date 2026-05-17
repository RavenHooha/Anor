import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import InterestChips from '../components/InterestChips';
import FoundingBadge from '../components/FoundingBadge';
import { isFoundingMember } from '../lib/founding';
import { getMyProfile, type Profile } from '../storage/profile';
import { track } from '../lib/analytics';
import { SHARE_MESSAGE } from '../lib/links';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const navigation = useNavigation<Nav>();

  useFocusEffect(
    useCallback(() => {
      getMyProfile().then((p) => {
        setProfile(p);
        setLoaded(true);
      });
    }, []),
  );

  const onShare = async () => {
    try {
      const result = await Share.share({
        message: SHARE_MESSAGE,
        title: 'Anor',
      });
      if (result.action === Share.sharedAction) {
        track('shared_app');
      }
    } catch {
      // Share sheet cancelled or unavailable.
    }
  };

  if (!loaded) {
    return <SafeAreaView style={styles.safe} edges={['top']} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          hitSlop={12}
          style={({ pressed }) => [styles.gearBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          style={({ pressed }) => [
            styles.avatarPressable,
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={styles.avatarFrame}>
            {profile?.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarEmpty} />
            )}
            <View style={styles.avatarEditIcon}>
              <Ionicons name="pencil" size={14} color={colors.background} />
            </View>
          </View>
        </Pressable>

        <Text style={styles.name}>{profile?.name ?? 'Unnamed'}</Text>

        {isFoundingMember(profile?.createdAt) && (
          <View style={styles.badgeRow}>
            <FoundingBadge size="md" />
          </View>
        )}

        {profile?.bio && profile.bio.length > 0 && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}

        {profile && profile.interests.length > 0 && (
          <InterestChips interests={profile.interests} align="center" />
        )}

        {profile?.createdAt && (
          <Text style={styles.joinedText}>
            Joined {new Date(profile.createdAt).toLocaleString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        )}

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.editBtn,
              pressed && styles.editBtnPressed,
            ]}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.secondary} />
            <Text style={styles.editLabel}>Edit profile</Text>
          </Pressable>

          <Pressable
            onPress={onShare}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.shareBtn,
              pressed && styles.shareBtnPressed,
            ]}
          >
            <Ionicons name="share-outline" size={16} color={colors.background} />
            <Text style={styles.shareLabel}>Invite a friend</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  avatarPressable: { alignSelf: 'center' },
  avatarFrame: {
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
  avatarEditIcon: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
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
  badgeRow: { alignItems: 'center', marginTop: -spacing.sm },
  joinedText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: -spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  editBtnPressed: { backgroundColor: colors.surfaceElevated },
  editLabel: { color: colors.secondary, fontSize: 14, fontWeight: '600' },
  shareBtn: { backgroundColor: colors.primary },
  shareBtnPressed: { backgroundColor: colors.primaryDim },
  shareLabel: { color: colors.background, fontSize: 14, fontWeight: '600' },
});
