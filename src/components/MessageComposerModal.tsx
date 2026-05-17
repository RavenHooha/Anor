import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../theme';

const MESSAGE_LIMIT = 120;

type Props = {
  visible: boolean;
  recipientName: string;
  onCancel: () => void;
  onSend: (message: string) => void;
};

export default function MessageComposerModal({
  visible,
  recipientName,
  onCancel,
  onSend,
}: Props) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Message {recipientName}</Text>
          <Text style={typography.caption}>
            One opener. Make it count.
          </Text>

          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, MESSAGE_LIMIT))}
            placeholder="Say hi…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            autoFocus
            maxLength={MESSAGE_LIMIT}
          />
          <Text style={styles.counter}>
            {text.length}/{MESSAGE_LIMIT}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                pressed && styles.btnGhostPressed,
              ]}
            >
              <Text style={styles.btnGhostLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!canSend}
              onPress={() => onSend(trimmed)}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                !canSend && styles.btnDisabled,
                pressed && canSend && styles.btnPrimaryPressed,
              ]}
            >
              <Text style={styles.btnPrimaryLabel}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: { ...typography.title },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 96,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  counter: { ...typography.caption, textAlign: 'right' },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostPressed: { borderColor: colors.textMuted },
  btnGhostLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: '500' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryPressed: { backgroundColor: colors.primaryDim },
  btnDisabled: { backgroundColor: colors.surfaceElevated },
  btnPrimaryLabel: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
