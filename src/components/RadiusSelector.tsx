import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { RADIUS_PRESETS } from '../data/nearby';

type Props = {
  current: number;
  onChange: (meters: number) => void;
};

export default function RadiusSelector({ current, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Looking within</Text>
      <View style={styles.row}>
        {RADIUS_PRESETS.map((p) => {
          const selected = p.meters === current;
          return (
            <Pressable
              key={p.id}
              onPress={() => onChange(p.meters)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && !selected && styles.chipPressed,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.label, selected && styles.labelSelected]}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  heading: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  chipPressed: { borderColor: colors.textMuted },
  chipSelected: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  label: { ...typography.caption, fontWeight: '600', color: colors.textSecondary },
  labelSelected: { color: colors.primary },
});
