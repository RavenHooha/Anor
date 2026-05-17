import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';

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
    gap: 4,
    paddingVertical: 2,
  },
  badgeMd: {
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
