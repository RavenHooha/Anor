import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type Props = {
  active: boolean;
  onPress: () => void;
};

// Header bell. When something's waiting it lights up (fill + accent color),
// pulses a soft glow ring, and shows a dot. Quiet otherwise.
export default function NotificationBell({ active, onPress }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.9],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 0.05, 1],
    outputRange: [0, 0.4, 0],
  });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.6 }]}
    >
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
      )}
      <View style={[styles.btn, active && styles.btnActive]}>
        <Ionicons
          name={active ? 'notifications' : 'notifications-outline'}
          size={22}
          color={active ? colors.primary : colors.textSecondary}
        />
      </View>
      {active && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: { borderColor: colors.primary },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
