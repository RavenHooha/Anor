import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyboardProvider,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colors, spacing, radius, typography } from '../theme';

const MESSAGE_LIMIT = 120;

type Props = {
  visible: boolean;
  recipientName: string;
  onCancel: () => void;
  onSend: (message: string) => void;
};

export default function MessageComposerModal(props: Props) {
  // RN Modal renders in a separate native window, outside the app-root
  // KeyboardProvider — so the keyboard hooks need it re-wrapped here.
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onCancel}
    >
      <KeyboardProvider>
        <ComposerSheet {...props} />
      </KeyboardProvider>
    </Modal>
  );
}

function ComposerSheet({ visible, recipientName, onCancel, onSend }: Props) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const { height: kbHeight } = useReanimatedKeyboardAnimation();

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  // Lift the sheet by the real keyboard height so the input never hides
  // behind it. Same approach proven in ChatScreen — works on Android with
  // edge-to-edge, where KeyboardAvoidingView does not.
  const liftStyle = useAnimatedStyle(() => ({
    marginBottom: Math.abs(kbHeight.value),
  }));

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  return (
    <View style={styles.flex}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <Animated.View style={liftStyle}>
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Message {recipientName}</Text>
          <Text style={typography.caption}>One opener. Make it count.</Text>

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
      </Animated.View>
    </View>
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
