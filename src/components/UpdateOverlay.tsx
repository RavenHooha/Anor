import { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';
import { colors, spacing, typography, radius } from '../theme';

// Shown full-screen while an OTA update downloads (App.tsx flips it on when
// Updates.fetchUpdateAsync runs). expo-updates doesn't report byte progress,
// so the bar is an indeterminate "working" animation, not a real percentage.
const TRACK_WIDTH = 200;
const FILL_WIDTH = 72;

export default function UpdateOverlay() {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [x]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-FILL_WIDTH, TRACK_WIDTH],
  });

  return (
    <View style={styles.overlay}>
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Updating Anor</Text>
      <Text style={styles.sub}>Getting the latest version…</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { transform: [{ translateX }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    zIndex: 100,
  },
  logo: { width: 84, height: 84, marginBottom: spacing.sm },
  title: { ...typography.title, color: colors.primary },
  sub: { ...typography.caption, color: colors.textMuted },
  track: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  fill: {
    width: FILL_WIDTH,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
