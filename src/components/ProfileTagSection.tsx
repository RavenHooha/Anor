import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, spacing, radius } from '../theme';
import SectionHeader from './SectionHeader';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  tags: string[];
  accent: string;
  align?: 'left' | 'center';
};

// Shared "card" treatment for the tag groups on a profile (Interests,
// How-to-connect). Each is a bordered panel with an icon + uppercase
// header and high-contrast chips, so the sections read as deliberate,
// prominent blocks rather than faint floating chips.
export default function ProfileTagSection({
  icon,
  label,
  tags,
  accent,
  align = 'left',
}: Props) {
  if (tags.length === 0) return null;
  const center = align === 'center';
  return (
    <View style={styles.card}>
      <SectionHeader icon={icon} label={label} accent={accent} align={align} />
      <View style={[styles.row, center && styles.centerRow]}>
        {tags.map((tag) => (
          <View key={tag} style={styles.chip}>
            <Text style={styles.chipText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  centerRow: { justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});
