import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { TIER_BY_ID, type SubscriptionTier } from '../types/subscription';

// Anor's spiral-sun mark, tinted to the tier metal. Patron/benefactor (the
// "animated" tiers) get a slow continuous rotation; benefactor also glows.
// Uses the built-in Animated API (native driver) so it ships over-the-air
// with no extra native dependency. Renders nothing for non-supporters.
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
  const animated = !!tier && TIER_BY_ID[tier].badgeAnimated;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, spin]);

  if (!tier) return null;

  const color = METAL[tier];
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        tier === 'benefactor' ? [styles.glow, { shadowColor: color }] : null,
        animated ? { transform: [{ rotate }] } : null,
      ]}
    >
      <Animated.Image
        source={require('../../assets/logo.png')}
        style={{ width: size, height: size, tintColor: color }}
        resizeMode="contain"
      />
    </Animated.View>
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
