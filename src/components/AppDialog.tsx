import { useEffect, useReducer, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

/**
 * Themed in-app replacement for React Native's native `Alert.alert`, which the
 * OS renders and we can't style. The signature mirrors `Alert.alert(title,
 * message?, buttons?)` so call sites migrate with a near find/replace:
 *
 *   Alert.alert('Check out?', 'You'll stop showing here.', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'Check out', style: 'destructive', onPress: doCheckout },
 *   ])
 *   →
 *   showDialog('Check out?', 'You'll stop showing here.', [ ...same... ])
 *
 * `<DialogHost />` is mounted once at the app root and renders whatever
 * `showDialog` queues. Imperative-from-anywhere (incl. non-React code), like
 * the API it replaces.
 */

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void;
}

interface DialogRequest {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

// Module-level queue + a single host subscriber. Multiple showDialog() calls
// stack and surface one at a time, matching native Alert behavior.
const queue: DialogRequest[] = [];
let notifyHost: (() => void) | null = null;

export function showDialog(
  title: string,
  message?: string,
  buttons?: DialogButton[],
): void {
  queue.push({
    title,
    message: message || undefined,
    buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
  });
  notifyHost?.();
}

export function DialogHost() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    notifyHost = () => {
      setVisible(true);
      force();
    };
    if (queue.length) setVisible(true);
    return () => {
      notifyHost = null;
    };
  }, []);

  const current = queue[0] ?? null;

  function press(button: DialogButton) {
    button.onPress?.();
    // onPress may itself queue a follow-up dialog (chained flows) — shift the
    // current request, then close only if nothing is left to show.
    queue.shift();
    if (queue.length === 0) setVisible(false);
    force();
  }

  function dismiss() {
    if (!current) return;
    // Backdrop tap / Android back = the cancel button if there is one, else a
    // no-op close (mirrors how a destructive-only alert can't be casually
    // dismissed into its dangerous action).
    const cancel = current.buttons.find((b) => b.style === 'cancel');
    if (cancel) press(cancel);
    else if (current.buttons.length === 1) press(current.buttons[0]);
  }

  if (!current) {
    return (
      <Modal visible={false} transparent animationType="fade">
        <View />
      </Modal>
    );
  }

  const row = current.buttons.length === 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        {/* Stop propagation so taps on the card don't dismiss. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? (
            <Text style={styles.message}>{current.message}</Text>
          ) : null}
          <View style={[styles.buttons, row && styles.buttonsRow]}>
            {current.buttons.map((b, i) => (
              <DialogButtonView
                key={`${b.text}-${i}`}
                button={b}
                grow={row}
                onPress={() => press(b)}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogButtonView({
  button,
  grow,
  onPress,
}: {
  button: DialogButton;
  grow: boolean;
  onPress: () => void;
}) {
  const isCancel = button.style === 'cancel';
  const isDestructive = button.style === 'destructive';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        grow && styles.buttonGrow,
        isCancel ? styles.buttonGhost : styles.buttonFilled,
        isDestructive && styles.buttonDestructive,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          isCancel && styles.buttonTextCancel,
          isDestructive && styles.buttonTextDestructive,
        ]}
      >
        {button.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  buttons: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  buttonsRow: {
    flexDirection: 'row',
  },
  button: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGrow: {
    flex: 1,
  },
  buttonFilled: {
    backgroundColor: colors.primary,
  },
  buttonDestructive: {
    backgroundColor: colors.danger,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  buttonTextCancel: {
    color: colors.textSecondary,
  },
  buttonTextDestructive: {
    color: colors.background,
  },
});
