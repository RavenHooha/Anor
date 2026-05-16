import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { INTEREST_OPTIONS, MAX_INTERESTS } from '../types/interests';

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function InterestPicker({ selected, onChange }: Props) {
  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else if (selected.length < MAX_INTERESTS) {
      onChange([...selected, tag]);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.counter}>
        {selected.length} of {MAX_INTERESTS} selected
      </Text>
      <View style={styles.row}>
        {INTEREST_OPTIONS.map((tag) => {
          const isSelected = selected.includes(tag);
          const disabled = !isSelected && selected.length >= MAX_INTERESTS;
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                disabled && styles.chipDisabled,
                pressed && !disabled && !isSelected && styles.chipPressed,
              ]}
            >
              <Text
                style={[
                  styles.label,
                  isSelected && styles.labelSelected,
                  disabled && styles.labelDisabled,
                ]}
              >
                {tag}
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
  counter: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipPressed: { borderColor: colors.textMuted },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipDisabled: { opacity: 0.4 },
  label: { ...typography.caption, fontWeight: '600', color: colors.textSecondary },
  labelSelected: { color: colors.background },
  labelDisabled: { color: colors.textMuted },
});
