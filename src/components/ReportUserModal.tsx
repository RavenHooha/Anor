import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyboardProvider,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colors, spacing, radius, typography } from '../theme';
import {
  REPORT_REASONS,
  REPORT_NOTES_MAX,
  reportUser,
  type ReportReason,
} from '../data/reports';

type Props = {
  visible: boolean;
  reportedId: string;
  reportedName: string;
  contextThreadId?: string | null;
  onCancel: () => void;
  onSubmitted: () => void;
};

export default function ReportUserModal(props: Props) {
  // RN Modal renders outside the app-root KeyboardProvider — re-wrap it so the
  // keyboard hooks work inside the modal's separate native window.
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onCancel}
    >
      <KeyboardProvider>
        <ReportSheet {...props} />
      </KeyboardProvider>
    </Modal>
  );
}

function ReportSheet({
  visible,
  reportedId,
  reportedName,
  contextThreadId,
  onCancel,
  onSubmitted,
}: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { height: kbHeight } = useReanimatedKeyboardAnimation();
  const { height: winHeight } = useWindowDimensions();

  // Lift the sheet above the keyboard, and cap its height to the space that's
  // left so the title never gets pushed off the top — the reason list shrinks
  // and scrolls to absorb the squeeze.
  const sheetStyle = useAnimatedStyle(() => {
    const kb = Math.abs(kbHeight.value);
    return {
      marginBottom: kb,
      maxHeight: Math.min(winHeight * 0.92, winHeight - kb - insets.top - 8),
    };
  });

  useEffect(() => {
    if (visible) {
      setReason(null);
      setNotes('');
      setError(null);
    }
  }, [visible]);

  const canSubmit = reason !== null && !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportUser(reportedId, reason, contextThreadId ?? null, notes);
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit report.');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          { paddingBottom: spacing.lg + insets.bottom },
        ]}
      >
          <View style={styles.handle} />
          <Text style={styles.title}>Report {reportedName}</Text>
          <Text style={styles.caption}>
            Reports are anonymous to {reportedName}. We review them and may take action.
          </Text>

          <ScrollView
            style={styles.reasons}
            contentContainerStyle={styles.reasonsContent}
          >
            {REPORT_REASONS.map((r) => {
              const selected = reason === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setReason(r.id)}
                  style={({ pressed }) => [
                    styles.reasonRow,
                    selected && styles.reasonRowSelected,
                    pressed && !selected && { opacity: 0.7 },
                  ]}
                >
                  <View style={styles.reasonText}>
                    <Text
                      style={[
                        styles.reasonLabel,
                        selected && styles.reasonLabelSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                    <Text style={styles.reasonDescription}>{r.description}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <TextInput
            value={notes}
            onChangeText={(t) => setNotes(t.slice(0, REPORT_NOTES_MAX))}
            placeholder="Anything else we should know (optional)"
            placeholderTextColor={colors.textMuted}
            style={styles.notes}
            multiline
            maxLength={REPORT_NOTES_MAX}
          />
          <Text style={styles.counter}>
            {notes.length}/{REPORT_NOTES_MAX}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={submitting}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                pressed && styles.btnGhostPressed,
              ]}
            >
              <Text style={styles.btnGhostLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!canSubmit}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                !canSubmit && styles.btnDisabled,
                pressed && canSubmit && styles.btnPrimaryPressed,
              ]}
            >
              <Text style={styles.btnPrimaryLabel}>
                {submitting ? 'Submitting…' : 'Submit'}
              </Text>
            </Pressable>
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
  caption: { ...typography.caption },
  reasons: { maxHeight: 320, flexShrink: 1 },
  reasonsContent: { gap: spacing.xs, paddingVertical: spacing.sm },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reasonRowSelected: {
    borderColor: colors.primary,
  },
  reasonText: { flex: 1, gap: 2 },
  reasonLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  reasonLabelSelected: { color: colors.primary },
  reasonDescription: { ...typography.caption, color: colors.textSecondary },
  notes: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  counter: { ...typography.caption, textAlign: 'right' },
  errorText: { ...typography.caption, color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
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
