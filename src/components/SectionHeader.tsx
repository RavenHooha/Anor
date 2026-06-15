import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { spacing } from '../theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  accent: string;
  align?: 'left' | 'center';
};

// Shared icon + uppercase accent header used both on the profile tag
// cards (ProfileTagSection) and above the matching pickers in Edit
// Profile, so "how you set it" and "how it shows" read identically.
export default function SectionHeader({ icon, label, accent, align = 'left' }: Props) {
  return (
    <View style={[styles.row, align === 'center' && styles.center]}>
      <Ionicons name={icon} size={15} color={accent} />
      <Text style={[styles.label, { color: accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  center: { justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
});
