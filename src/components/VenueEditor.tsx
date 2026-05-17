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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../theme';
import { setVenue, clearVenue, VENUE_MAX_LENGTH } from '../data/venue';

type Props = {
  venue: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
};

export default function VenueEditor({ venue, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (open) {
      setText(venue ?? '');
      setError(null);
    }
  }, [open, venue]);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && trimmed !== venue && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await setVenue(trimmed);
      onChange(trimmed);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save place.');
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    setSaving(true);
    setError(null);
    try {
      await clearVenue();
      onChange(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear place.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.chip,
          venue ? styles.chipFilled : styles.chipEmpty,
          pressed && !disabled && { opacity: 0.7 },
          disabled && { opacity: 0.4 },
        ]}
      >
        <Ionicons
          name={venue ? 'location' : 'location-outline'}
          size={16}
          color={venue ? colors.primary : colors.textMuted}
        />
        <Text
          numberOfLines={1}
          style={[styles.chipText, venue && styles.chipTextFilled]}
        >
          {venue ?? 'Add a place'}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Where are you?</Text>
            <Text style={typography.caption}>
              Restaurant, park, bookstore — whatever you'd want a stranger to
              know. Clears automatically when you move.
            </Text>

            <TextInput
              value={text}
              onChangeText={(t) => setText(t.slice(0, VENUE_MAX_LENGTH))}
              placeholder="Blue Bottle Coffee"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onSave}
              maxLength={VENUE_MAX_LENGTH}
            />
            <Text style={styles.counter}>
              {text.length}/{VENUE_MAX_LENGTH}
            </Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.actions}>
              {venue && (
                <Pressable
                  onPress={onClear}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnGhost,
                    pressed && styles.btnGhostPressed,
                  ]}
                >
                  <Text style={styles.btnGhostLabel}>Clear</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setOpen(false)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnGhost,
                  pressed && styles.btnGhostPressed,
                ]}
              >
                <Text style={styles.btnGhostLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!canSave}
                onPress={onSave}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnPrimary,
                  !canSave && styles.btnDisabled,
                  pressed && canSave && styles.btnPrimaryPressed,
                ]}
              >
                <Text style={styles.btnPrimaryLabel}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipEmpty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  chipFilled: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderStyle: 'solid',
  },
  chipText: {
    ...typography.caption,
    color: colors.textMuted,
    maxWidth: 220,
  },
  chipTextFilled: {
    color: colors.textPrimary,
    fontWeight: '600',
  },

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
    marginTop: spacing.sm,
  },
  counter: { ...typography.caption, textAlign: 'right' },
  errorText: { ...typography.caption, color: colors.primary },
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
