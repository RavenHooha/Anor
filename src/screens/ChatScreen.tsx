import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { blockUser } from '../storage/blocks';
import ReportUserModal from '../components/ReportUserModal';
import { colors, spacing, radius, typography } from '../theme';
import {
  createOrGetThread,
  getThread,
  listMessages,
  sendMessage,
  type Message,
  type ThreadDetail,
  MESSAGE_CAP,
  MESSAGE_LIMIT,
} from '../storage/threads';
import { subscribeToThreadMessages } from '../storage/realtime';
import MessageComposerModal from '../components/MessageComposerModal';
import { getMyProfile } from '../storage/profile';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route, navigation }: Props) {
  const { threadId } = route.params;
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [openerComposerOpen, setOpenerComposerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
    getMyProfile().then((p) => {
      setMyPhotoUrl(p?.photoUrl ?? p?.photos[0] ?? null);
      setMyName(p?.name ?? '');
    });
  }, []);

  const refreshThread = useCallback(async () => {
    const t = await getThread(threadId);
    setThread(t);
  }, [threadId]);

  useEffect(() => {
    refreshThread();
    listMessages(threadId).then(setMessages);
    return subscribeToThreadMessages(threadId, (incoming) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      // The first response from the recipient accepts the thread; refresh detail.
      refreshThread();
    });
  }, [threadId, refreshThread]);

  useEffect(() => {
    if (!thread) return;
    const otherName = thread.otherName;
    const otherId = thread.otherId;
    const confirmBlock = () => {
      Alert.alert(
        `Block ${otherName}?`,
        `You won't see ${otherName} in your nearby feed or messages, and they won't see you. This can be undone later.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () => {
              navigation.goBack();
              blockUser(otherId)
                .then(() => DeviceEventEmitter.emit('blockChanged'))
                .catch((e) => {
                  Alert.alert(
                    'Block failed',
                    e instanceof Error ? e.message : 'Try again.',
                  );
                });
            },
          },
        ],
      );
    };
    const openMenu = () => {
      Alert.alert(otherName, undefined, [
        { text: 'Report', onPress: () => setReportOpen(true) },
        { text: 'Block', style: 'destructive', onPress: confirmBlock },
        { text: 'Cancel', style: 'cancel' },
      ]);
    };
    navigation.setOptions({
      headerTitle: otherName,
      headerRight: () => (
        <Pressable
          onPress={openMenu}
          hitSlop={8}
          style={({ pressed }) => [
            { marginRight: 12, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      ),
    });
  }, [thread, navigation]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  if (!thread || !meId) {
    return <View style={styles.safe} />;
  }

  const isPending = thread.acceptedAt === null;
  const iInitiated = thread.initiatorId === meId;
  // Pre-acceptance, only the recipient can send (their first message accepts the thread).
  const canSend = !isPending || !iInitiated;
  const atCap = thread.messageCount >= MESSAGE_CAP;

  const onSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || sending || !canSend || atCap) return;
    setSending(true);
    setError(null);
    try {
      const sent = await sendMessage(threadId, trimmed);
      setBody('');
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      refreshThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        extraData={`${meId}|${myPhotoUrl}|${myName}|${thread.otherPhotoUrl}|${thread.otherName}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <OpenerHeader thread={thread} meId={meId} />
        }
        renderItem={({ item }) => {
          const isMine = item.fromUserId === meId;
          return (
            <MessageBubble
              message={item}
              isMine={isMine}
              photoUrl={isMine ? myPhotoUrl : thread.otherPhotoUrl}
              name={isMine ? myName : thread.otherName}
            />
          );
        }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {isPending && iInitiated && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            Waiting for {thread.otherName} to respond.
          </Text>
          {thread.openerText === null && (
            <Pressable
              onPress={() => setOpenerComposerOpen(true)}
              style={({ pressed }) => [
                styles.addOpenerBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.addOpenerText}>+ Add a message</Text>
            </Pressable>
          )}
        </View>
      )}

      <MessageComposerModal
        visible={openerComposerOpen}
        recipientName={thread.otherName}
        onCancel={() => setOpenerComposerOpen(false)}
        onSend={async (text) => {
          setOpenerComposerOpen(false);
          try {
            await createOrGetThread(thread.otherId, text);
            await refreshThread();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not add message.');
          }
        }}
      />

      <ReportUserModal
        visible={reportOpen}
        reportedId={thread.otherId}
        reportedName={thread.otherName}
        contextThreadId={thread.id}
        onCancel={() => setReportOpen(false)}
        onSubmitted={() => {
          setReportOpen(false);
          Alert.alert(
            'Report submitted',
            'Thanks — we\'ll review it. You may want to block this person too.',
          );
        }}
      />

      {atCap && (
        <View style={styles.capBanner}>
          <Text style={styles.capText}>
            Thread is full ({MESSAGE_CAP} messages). Wrap it up in person.
          </Text>
        </View>
      )}

      {canSend && !atCap && (
        <View style={styles.composer}>
          <TextInput
            value={body}
            onChangeText={(t) => setBody(t.slice(0, MESSAGE_LIMIT))}
            placeholder={
              isPending ? `Reply to ${thread.otherName}…` : 'Message…'
            }
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={MESSAGE_LIMIT}
          />
          <Pressable
            onPress={onSend}
            disabled={sending || body.trim().length === 0}
            style={({ pressed }) => [
              styles.sendBtn,
              (sending || body.trim().length === 0) && styles.sendBtnDisabled,
              pressed && !sending && body.trim().length > 0 && styles.sendBtnPressed,
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.background} />
          </Pressable>
        </View>
      )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OpenerHeader({ thread, meId }: { thread: ThreadDetail; meId: string }) {
  const iInitiated = thread.initiatorId === meId;
  const wave = thread.openerText === null;

  return (
    <View style={styles.headerBlock}>
      <View style={styles.avatarFrame}>
        {thread.otherPhotoUrl ? (
          <Image source={{ uri: thread.otherPhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]} />
        )}
      </View>
      <Text style={styles.headerName}>{thread.otherName}</Text>
      {wave ? (
        <Text style={styles.openerNote}>
          {iInitiated ? 'You sent a wave.' : `${thread.otherName} waved.`}
        </Text>
      ) : (
        <View style={styles.openerBubble}>
          <Text style={styles.openerWho}>
            {iInitiated ? 'You wrote' : `${thread.otherName} wrote`}
          </Text>
          <Text style={styles.openerText}>"{thread.openerText}"</Text>
        </View>
      )}
    </View>
  );
}

function MessageBubble({
  message,
  isMine,
  photoUrl,
  name,
}: {
  message: Message;
  isMine: boolean;
  photoUrl: string | null;
  name: string;
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatar = (
    <View style={styles.bubbleAvatar}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.bubbleAvatarImage} />
      ) : (
        <Text style={styles.bubbleAvatarInitial}>{initial}</Text>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.bubbleRow,
        isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
      ]}
    >
      {!isMine && avatar}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
          {message.body}
        </Text>
      </View>
      {isMine && avatar}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  headerBlock: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  avatarFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatar: { width: '100%', height: '100%' },
  headerName: { ...typography.title },
  openerNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  openerBubble: {
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    maxWidth: '85%',
    gap: 2,
    marginTop: spacing.md,
  },
  openerWho: { ...typography.caption, color: colors.textMuted },
  openerText: { ...typography.body, color: colors.textPrimary, fontStyle: 'italic' },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
    gap: spacing.xs,
  },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleAvatarImage: { width: '100%', height: '100%' },
  bubbleAvatarInitial: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.background, fontWeight: '500' },
  pendingBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  pendingText: { ...typography.caption, color: colors.textSecondary },
  addOpenerBtn: { paddingTop: spacing.xs },
  addOpenerText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  capBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  capText: { ...typography.caption, color: colors.textMuted },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    color: colors.textPrimary,
    fontSize: 16,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceElevated },
  sendBtnPressed: { backgroundColor: colors.primaryDim },
  errorText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
    paddingBottom: spacing.sm,
  },
});
