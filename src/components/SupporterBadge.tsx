import { View, Image, StyleSheet } from 'react-native';
import type { SubscriptionTier } from '../types/subscription';

// Anor's own spiral-sun mark, tinted to the tier metal — bronze / silver /
// gold — so it reads as "Anor's sun" rather than a stock icon. Gold (top
// tier) gets a soft glow. Renders nothing for non-supporters (null tier).
const METAL: Record<SubscriptionTier, string> = {
  supporter: '#cd7f32', // bronze
  patron: '#dfe4e8', // silver
  benefactor: '#ffcf3f', // gold
};

export default function SupporterBadge({
  tier,
  size = 18,
}: {
  tier: SubscriptionTier | null;
  size?: number;
}) {
  if (!tier) return null;
  const color = METAL[tier];
  return (
    <View
      style={
        tier === 'benefactor'
          ? [styles.glow, { shadowColor: color }]
          : undefined
      }
    >
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: size, height: size, tintColor: color }}
        resizeMode="contain"
      />
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
