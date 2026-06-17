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
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={require('../../assets/logo.png')}
        style={[styles.sun, { tintColor: bg.hue }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sun: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 420,
    height: 420,
    opacity: 0.1,
  },
});
