import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';

type Props = {
  size?: 'sm' | 'md';
};

export default function FoundingBadge({ size = 'sm' }: Props) {
  const isMd = size === 'md';
  return (
    <View style={[styles.badge, isMd && styles.badgeMd]}>
      <Ionicons
        name="sparkles"
        size={isMd ? 14 : 11}
        color={colors.highlight}
      />
      <Text style={[styles.label, isMd && styles.labelMd]}>
        Founding member
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.highlight,
    backgroundColor: colors.surface,
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    gap: 6,
  },
  label: {
    ...typography.caption,
    color: colors.highlight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  labelMd: {
    fontSize: 12,
  },
});
