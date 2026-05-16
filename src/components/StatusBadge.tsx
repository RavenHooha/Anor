import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import { STATUS_BY_ID, type Status } from '../types/status';

export default function StatusBadge({ status }: { status: Status | null }) {
  if (!status) {
    return (
      <View style={[styles.card, { borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="ellipse-outline" size={28} color={colors.textMuted} />
        </View>
        <View style={styles.text}>
          <Text style={styles.youAre}>Hey</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Pick a vibe</Text>
          <Text style={typography.caption}>
            You're invisible until you choose how you're showing up.
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </View>
    );
  }

  const cfg = STATUS_BY_ID[status];
  return (
    <View style={[styles.card, { borderColor: cfg.color }]}>
      <View style={[styles.iconWrap, { backgroundColor: cfg.color + '22' }]}>
        <Ionicons name={cfg.icon} size={28} color={cfg.color} />
      </View>
      <View style={styles.text}>
        <Text style={styles.youAre}>You're</Text>
        <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
        <Text style={typography.caption}>{cfg.description}</Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  youAre: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.title, fontSize: 26 },
});
