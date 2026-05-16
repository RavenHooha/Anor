import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import type { SignalStrength } from '../ble/service';

type Props = {
  signal: SignalStrength;
};

const SIGNAL_LABEL: Record<SignalStrength, string> = {
  strong: 'Close',
  medium: 'Nearby',
  weak: 'Just in range',
};

export default function MysteryCard({ signal }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.photoArea}>
        <Text style={styles.questionMark}>?</Text>
        <View style={[styles.statusDot, { backgroundColor: colors.highlight }]} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          Nigh nearby
        </Text>
        <View style={styles.statusRow}>
          <Ionicons name="radio-outline" size={14} color={colors.highlight} />
          <Text style={styles.statusLabel}>{SIGNAL_LABEL[signal]}</Text>
        </View>
        <Text style={styles.hint} numberOfLines={2}>
          Profile loads when they sign in.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.highlight,
    overflow: 'hidden',
  },
  photoArea: {
    width: 110,
    height: 110,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  questionMark: {
    fontSize: 56,
    fontWeight: '300',
    color: colors.highlight,
    opacity: 0.7,
  },
  statusDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  name: { ...typography.title, fontSize: 17, color: colors.highlight },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusLabel: { ...typography.caption, fontWeight: '600', color: colors.highlight },
  hint: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
});
