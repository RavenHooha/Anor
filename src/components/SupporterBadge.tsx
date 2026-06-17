import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SubscriptionTier } from '../types/subscription';

// Sun mark colored by tier — Anor's supporter signal. Bronze / silver / gold.
// Gold gets a soft glow. Renders nothing for non-supporters (null tier).
const METAL: Record<SubscriptionTier, string> = {
  supporter: '#cd7f32', // bronze
  patron: '#d6dade', // silver
  benefactor: '#ffcf3f', // gold
};

export default function SupporterBadge({
  tier,
  size = 16,
}: {
  tier: SubscriptionTier | null;
  size?: number;
}) {
  if (!tier) return null;
  const color = METAL[tier];
  return (
    <View style={tier === 'benefactor' ? [styles.glow, { shadowColor: color }] : undefined}>
      <Ionicons name="sunny" size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
});
