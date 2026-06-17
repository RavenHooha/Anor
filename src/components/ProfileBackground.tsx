import { View, Image, StyleSheet } from 'react-native';
import { BACKGROUND_BY_ID, validBackground } from '../types/cosmetics';

// A large, faint Anor sun watermark behind the profile, tinted to the chosen
// hue. Absolutely positioned and non-interactive so it sits behind content.
// Renders nothing when there's no (valid) background set.
export default function ProfileBackground({ id }: { id: string | null }) {
  const valid = validBackground(id);
  if (!valid) return null;
  const bg = BACKGROUND_BY_ID[valid];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <Image
        source={require('../../assets/logo.png')}
        style={[styles.sun, { tintColor: bg.hue }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-screen ambient wash: a large, very faint sun centered behind all
  // content — reads as mood lighting rather than a placed graphic, so there's
  // no awkward edge/clip to get wrong.
  center: { alignItems: 'center', justifyContent: 'center' },
  sun: {
    width: 680,
    height: 680,
    opacity: 0.05,
  },
});
