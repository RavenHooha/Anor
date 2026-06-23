import { useCallback, useState } from 'react';
import {
  View,
  Text,  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import Avatar from '../components/Avatar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import {
  listMyBlocks,
  unblockUser,
  type BlockedUser,
} from '../storage/blocks';

export default function BlockedUsersScreen() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listMyBlocks();
      setUsers(list);
    } catch {}
    setLoaded(true);
  }, []);

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

  const onUnblock = async (userId: string) => {
    if (busyId) return;
    setBusyId(userId);
    try {
      await unblockUser(userId);
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
    } catch {} finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.userId}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatarFrame}>
              <Avatar uri={item.photoUrl} name={item.name} size={44} style={styles.avatar} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Pressable
              onPress={() => onUnblock(item.userId)}
              disabled={busyId === item.userId}
              style={({ pressed }) => [
                styles.unblockBtn,
                pressed && busyId !== item.userId && styles.unblockPressed,
              ]}
            >
              <Text style={styles.unblockLabel}>
                {busyId === item.userId ? 'Unblocking…' : 'Unblock'}
              </Text>
            </Pressable>
          </View>
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <Text style={styles.heading}>Blocked</Text>
        }
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.empty}>
              You haven't blocked anyone.
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    gap: spacing.sm,
  },
  separator: { height: spacing.sm },
  heading: {
    ...typography.display,
    color: colors.secondary,
    marginBottom: spacing.md,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  name: { ...typography.title, fontSize: 16, flex: 1 },
  unblockBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  unblockPressed: { borderColor: colors.secondary },
  unblockLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
});
