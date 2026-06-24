import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import { STATUS_BY_ID } from '../types/status';
import MessageComposerModal from '../components/MessageComposerModal';
import { showDialog } from '../components/AppDialog';
import ReportUserModal from '../components/ReportUserModal';
import InterestChips from '../components/InterestChips';
import ConnectPrefChips from '../components/ConnectPrefChips';
import PhotoGalleryViewer from '../components/PhotoGalleryViewer';
import FoundingBadge from '../components/FoundingBadge';
import SupporterBadge from '../components/SupporterBadge';
import ProfileBackground from '../components/ProfileBackground';
import { validAccent, validBackground } from '../types/cosmetics';
import { tierAtLeast } from '../types/subscription';
import { isFoundingMember } from '../lib/founding';
import { createOrGetThread, findExistingThread } from '../storage/threads';
import { blockUser } from '../storage/blocks';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { user } = route.params;
  const cfg = STATUS_BY_ID[user.status];
  const bioColor = tierAtLeast(user.supporter.tier, 'patron')
    ? (validAccent(user.supporter.accentColor) ?? colors.highlight)
    : undefined;

  const [composerOpen, setComposerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [pending, setPending] = useState<'wave' | 'message' | null>(null);
  const [existingThreadId, setExistingThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    findExistingThread(user.id).then(setExistingThreadId);
  }, [user.id]);

  const openChat = (threadId: string) => {
    navigation.replace('Chat', { threadId });
  };

  const onWave = async () => {
    if (pending) return;
    setPending('wave');
    setError(null);
    try {
      const threadId = await createOrGetThread(user.id, null);
      openChat(threadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not wave.');
      setPending(null);
    }
  };

  const onSendMessage = async (text: string) => {
    if (pending) return;
    setPending('message');
    setError(null);
    setComposerOpen(false);
    try {
      const threadId = await createOrGetThread(user.id, text);
      openChat(threadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message.');
      setPending(null);
    }
  };

  const waveBusy = pending === 'wave';
  const messageBusy = pending === 'message';

  return (
    <SafeAreaView style={styles.scroll} edges={['bottom']}>
      <ProfileBackground id={validBackground(user.supporter.profileBackground)} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <PhotoGalleryViewer
        photos={user.photos.length > 0 ? user.photos : user.photoUrl ? [user.photoUrl] : []}
        aspectRatio={1}
      />

      <View style={styles.nameRow}>
        <Text
          style={[
            styles.name,
            validAccent(user.supporter.accentColor)
              ? { color: validAccent(user.supporter.accentColor)! }
              : null,
          ]}
        >
          {user.name}
        </Text>
        <SupporterBadge tier={user.supporter.tier} size={30} />
      </View>

      {isFoundingMember(user.createdAt) && (
        <View style={{ alignItems: 'center' }}>
          <FoundingBadge size="md" />
        </View>
      )}

      {user.venue && (
        <View style={styles.venueRow}>
          <Ionicons name="location" size={14} color={colors.primary} />
          <Text style={styles.venueText}>{user.venue}</Text>
        </View>
      )}

      {user.bio.length > 0 && (
        <Text style={[styles.bio, bioColor ? { color: bioColor } : null]}>
          {user.bio}
        </Text>
      )}

      <InterestChips interests={user.interests} align="center" />

      <ConnectPrefChips prefs={user.connectPrefs} align="center" />

      <View style={[styles.statusCard, { borderColor: cfg.color }]}>
        <View style={[styles.iconWrap, { backgroundColor: cfg.color + '22' }]}>
          <Ionicons name={cfg.icon} size={26} color={cfg.color} />
        </View>
        <View style={styles.statusText}>
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={typography.caption}>{cfg.description}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onWave}
          disabled={!!pending}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.waveBtn,
            pressed && !pending && styles.waveBtnPressed,
          ]}
        >
          <Ionicons name="hand-left-outline" size={20} color={colors.secondary} />
          <Text style={[styles.actionLabel, { color: colors.secondary }]}>
            {waveBusy ? 'Waving…' : 'Wave'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (existingThreadId) {
              navigation.replace('Chat', { threadId: existingThreadId });
            } else {
              setComposerOpen(true);
            }
          }}
          disabled={!!pending}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.messageBtn,
            pressed && !pending && styles.messageBtnPressed,
          ]}
        >
          <Ionicons
            name={existingThreadId ? 'chatbubble-outline' : 'paper-plane-outline'}
            size={20}
            color={colors.background}
          />
          <Text style={[styles.actionLabel, { color: colors.background }]}>
            {messageBusy
              ? 'Sending…'
              : existingThreadId
                ? 'Open chat'
                : 'Message'}
          </Text>
        </Pressable>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.safetyRow}>
        <Pressable
          onPress={() => setReportOpen(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.safetyItem, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="flag-outline" size={15} color={colors.textMuted} />
          <Text style={styles.safetyText}>Report</Text>
        </Pressable>

        <View style={styles.safetyDivider} />

        <Pressable
          hitSlop={8}
          onPress={() => {
            showDialog(
              `Block ${user.name}?`,
              `You won't see ${user.name} in your nearby feed or messages, and they won't see you. This can be undone later.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: () => {
                    // Optimistic close — block in background. On success,
                    // emit so dependent screens (ThreadsList, Home) refetch.
                    navigation.goBack();
                    blockUser(user.id)
                      .then(() => DeviceEventEmitter.emit('blockChanged'))
                      .catch((e) => {
                        showDialog(
                          'Block failed',
                          e instanceof Error ? e.message : 'Try again.',
                        );
                      });
                  },
                },
              ],
            );
          }}
          style={({ pressed }) => [styles.safetyItem, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="ban-outline" size={15} color={colors.textMuted} />
          <Text style={styles.safetyText}>Block</Text>
        </Pressable>
      </View>

      </ScrollView>

      <MessageComposerModal
        visible={composerOpen}
        recipientName={user.name}
        onCancel={() => setComposerOpen(false)}
        onSend={onSendMessage}
      />

      <ReportUserModal
        visible={reportOpen}
        reportedId={user.id}
        reportedName={user.name}
        onCancel={() => setReportOpen(false)}
        onSubmitted={() => {
          setReportOpen(false);
          showDialog(
            'Report submitted',
            'Thanks — we\'ll review it. You may want to block this person too.',
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    alignItems: 'stretch',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  bio: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  venueText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { flex: 1, gap: 2 },
  statusLabel: { ...typography.title, fontSize: 22 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  waveBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  waveBtnPressed: { backgroundColor: colors.surfaceElevated },
  messageBtn: { backgroundColor: colors.primary },
  messageBtnPressed: { backgroundColor: colors.primaryDim },
  actionLabel: { fontSize: 16, fontWeight: '600' },
  errorText: { ...typography.caption, color: colors.primary, textAlign: 'center' },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  safetyText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },
  safetyDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.border,
  },
});
