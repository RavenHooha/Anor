import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import { STATUSES, type Status } from '../types/status';

type Props = {
  current: Status | null;
  onChange: (status: Status) => void;
};

export default function StatusSelector({ current, onChange }: Props) {
  return (
    <View style={styles.row}>
      {STATUSES.map((s) => {
        const selected = s.id === current;
        return (
          <Pressable
            key={s.id}
            onPress={() => onChange(s.id)}
            style={({ pressed }) => [
              styles.chip,
              selected && { borderColor: s.color, backgroundColor: colors.surfaceElevated },
              pressed && !selected && styles.chipPressed,
            ]}
          >
            <Ionicons
              name={s.icon}
              size={22}
              color={selected ? s.color : colors.textMuted}
            />
            <Text
              style={[
                styles.label,
                { color: selected ? s.color : colors.textSecondary },
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.xs,
  },
  chipPressed: { borderColor: colors.textMuted },
  label: { ...typography.caption, fontWeight: '600' },
});
