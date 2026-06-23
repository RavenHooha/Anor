import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { listUsersAsMaker, startMakerThread, type MakerUser } from '../storage/maker';

type Props = NativeStackScreenProps<RootStackParamList, 'Maker'>;

const BODY_LIMIT = 500;

function initial(name: string): string {
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : '?';
}

export default function MakerScreen({ navigation }: Props) {
  const [users, setUsers] = useState<MakerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<MakerUser | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const rows = await listUsersAsMaker(term.trim() || null);
      setUsers(rows);
    } catch (e) {
      Alert.alert('Could not load people', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  // Debounce the search so each keystroke doesn't fire an RPC.
  const onSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(text), 300);
  };

  const closeComposer = () => {
    setTarget(null);
    setBody('');
  };

  const onSend = async () => {
    const trimmed = body.trim();
    if (!target || !trimmed || sending) return;
    setSending(true);
    try {
      const threadId = await startMakerThread(target.id, trimmed);
      closeComposer();
      navigation.navigate('Chat', { threadId });
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  const renderUser = ({ item }: { item: MakerUser }) => (
    <Pressable
      onPress={() => setTarget(item)}
      accessibilityRole="button"
      accessibilityLabel={`Message ${item.name}${item.hasThread ? ', already in your messages' : ''}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarEmpty]}>
          <Text style={styles.avatarInitial}>{initial(item.name)}</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name || 'Unnamed'}
        </Text>
        {item.hasThread && <Text style={styles.rowHint}>Already in your messages</Text>}
      </View>
      <Ionicons
        name={item.hasThread ? 'chatbubble' : 'chatbubble-outline'}
        size={18}
        color={item.hasThread ? colors.primary : colors.textMuted}
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search people by name"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          accessibilityLabel="Search people by name"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {search.trim() ? 'No one matches that name.' : 'No one here yet.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={target !== null}
        animationType="slide"
        transparent
        onRequestClose={closeComposer}
      >
        <Pressable style={styles.backdrop} onPress={closeComposer} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Message {target?.name || 'this person'}</Text>
            <Text style={styles.sheetHint}>
              Sent as the maker — lands in their inbox directly, with your verified badge.
            </Text>
            <TextInput
              value={body}
              onChangeText={(t) => setBody(t.slice(0, BODY_LIMIT))}
              placeholder="Write your message…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              autoFocus
              maxLength={BODY_LIMIT}
              accessibilityLabel="Message body"
            />
            <Text style={styles.counter}>
              {body.length}/{BODY_LIMIT}
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={closeComposer}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.btnGhostPressed]}
              >
                <Text style={styles.btnGhostLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!body.trim() || sending}
                onPress={onSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !body.trim() || sending }}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnPrimary,
                  (!body.trim() || sending) && styles.btnDisabled,
                  pressed && body.trim() && !sending && styles.btnPrimaryPressed,
                ]}
              >
                <Text style={styles.btnPrimaryLabel}>{sending ? 'Sending…' : 'Send'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { opacity: 0.6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  rowText: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  rowHint: { ...typography.caption, color: colors.textMuted },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: { ...typography.title },
  sheetHint: { ...typography.caption, color: colors.textMuted },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 110,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  counter: { ...typography.caption, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnGhostPressed: { borderColor: colors.textMuted },
  btnGhostLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: '500' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryPressed: { backgroundColor: colors.primaryDim },
  btnDisabled: { backgroundColor: colors.surfaceElevated },
  btnPrimaryLabel: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
