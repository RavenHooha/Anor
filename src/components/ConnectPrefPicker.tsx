import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { CONNECT_PREF_OPTIONS, MAX_CONNECT_PREFS } from '../types/connectPrefs';

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
};

// Mirrors InterestPicker, but uses the secondary accent so it reads as a
// distinct kind of signal ("how to reach me") rather than another interest.
export default function ConnectPrefPicker({ selected, onChange }: Props) {
  const toggle = (pref: string) => {
    if (selected.includes(pref)) {
      onChange(selected.filter((p) => p !== pref));
    } else if (selected.length < MAX_CONNECT_PREFS) {
      onChange([...selected, pref]);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.counter}>
        {selected.length} of {MAX_CONNECT_PREFS} selected
      </Text>
      <View style={styles.row}>
        {CONNECT_PREF_OPTIONS.map((pref) => {
          const isSelected = selected.includes(pref);
          const disabled = !isSelected && selected.length >= MAX_CONNECT_PREFS;
          return (
            <Pressable
              key={pref}
              onPress={() => toggle(pref)}
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
                {pref}
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
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  chipDisabled: { opacity: 0.4 },
  label: { ...typography.caption, fontWeight: '600', color: colors.textSecondary },
  labelSelected: { color: colors.background },
  labelDisabled: { color: colors.textMuted },
});
