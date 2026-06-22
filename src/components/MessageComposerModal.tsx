import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';
import { colors, spacing, radius, typography } from '../theme';

const MESSAGE_LIMIT = 120;

type Props = {
  visible: boolean;
  recipientName: string;
  onCancel: () => void;
  onSend: (message: string) => void;
};

// Rendered in-tree (NOT an RN Modal) so it lives under the app-root
// KeyboardProvider, where the keyboard-height hook actually measures correctly.
// Inside an RN Modal (a separate native window) the height comes back wrong on
// Android and the sheet lifts short, leaving the buttons under the keyboard.
export default function MessageComposerModal({
  visible,
  recipientName,
  onCancel,
  onSend,
}: Props) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const { height: kbHeight } = useReanimatedKeyboardAnimation();

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const liftStyle = useAnimatedStyle(() => ({
    marginBottom: Math.abs(kbHeight.value),
  }));

  if (!visible) return null;

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdropWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(200)} style={liftStyle}>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 50,
  },
  backdropWrap: {
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
