import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, typography } from '../theme';
import { listMyThreads, hideThread, type ThreadSummary } from '../storage/threads';
import SwipeableRow from '../components/SwipeableRow';
import { subscribeToMyThreadChanges } from '../storage/realtime';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ThreadsListScreen() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const navigation = useNavigation<Nav>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    try {
      const t = await listMyThreads();
      setThreads(t);
    } catch {
      // empty state covers errors
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    return subscribeToMyThreadChanges(load);
  }, [load]);

  // Refetch when a block lands (the optimistic-close in Chat/UserProfile
  // races ahead of the network insert; this catches the late completion).
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('blockChanged', load);
    return () => sub.remove();
  }, [load]);

  // Re-fetch whenever the screen gains focus (e.g. returning from a chat
  // after blocking — blocks change what list_my_threads returns but don't
  // fire a threads-table event, so realtime alone misses the update).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = (threadId: string) => {
    navigation.navigate('Chat', { threadId });
  };

  const onRemove = useCallback(
    async (threadId: string) => {
      // Optimistic — drop it now, restore by refetch if the call fails. No
      // confirm dialog: swipe-then-tap-Remove is already deliberate, and a
      // removed thread is recoverable (it un-hides on any new message).
      setThreads((prev) => prev.filter((t) => t.threadId !== threadId));
      try {
        await hideThread(threadId);
      } catch {
        load();
      }
    },
    [load],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Messages</Text>
      </View>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.threadId}
        renderItem={({ item }) => (
          <SwipeableRow onRemove={() => onRemove(item.threadId)}>
            <ThreadRow
              item={item}
              meId={meId}
              onPress={() => open(item.threadId)}
            />
          </SwipeableRow>
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.emptyText}>
              No messages yet. Wave or message someone from the Nearby tab.
            </Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

function ThreadRow({
  item,
  meId,
  onPress,
}: {
  item: ThreadSummary;
  meId: string | null;
  onPress: () => void;
}) {
  const pending = item.acceptedAt === null;
  const iInitiated = item.initiatorId === meId;

  let preview: string;
  if (item.lastMessageBody) {
    const prefix = item.lastMessageFrom === meId ? 'You: ' : '';
    preview = `${prefix}${item.lastMessageBody}`;
  } else if (item.openerText) {
    preview = iInitiated ? `You: ${item.openerText}` : item.openerText;
  } else {
    preview = iInitiated ? 'You waved' : 'Waved you';
  }

  let badge: { label: string; color: string } | null = null;
  if (pending) {
    badge = iInitiated
      ? { label: 'Waiting', color: colors.textMuted }
      : { label: 'New', color: colors.primary };
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.avatarFrame}>
        {item.otherPhotoUrl ? (
          <Image source={{ uri: item.otherPhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]} />
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.otherName}
          </Text>
          {badge && (
            <View style={[styles.badge, { borderColor: badge.color }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  heading: { ...typography.display, color: colors.secondary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  separator: { height: spacing.sm },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  avatarFrame: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowName: { ...typography.title, fontSize: 16, flex: 1 },
  rowPreview: { ...typography.caption, color: colors.textSecondary },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
