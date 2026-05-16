import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

type Props = {
  interests: string[];
  align?: 'left' | 'center';
};

export default function InterestChips({ interests, align = 'left' }: Props) {
  if (interests.length === 0) return null;
  return (
    <View
      style={[
        styles.row,
        align === 'center' && { justifyContent: 'center' },
      ]}
    >
      {interests.map((tag) => (
        <View key={tag} style={styles.chip}>
          <Text style={styles.label}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
