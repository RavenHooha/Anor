import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import { colors, typography } from '../theme';

type Props = {
  uri: string | null | undefined;
  // Used for the initial-letter fallback when there's no photo or it fails.
  name?: string;
  size: number;
  borderRadius?: number;
  // Image-shaped style (width/height/bg/borderRadius); also applied to the
  // fallback View, which accepts the same layout props.
  style?: StyleProp<ImageStyle>;
};

function initial(name?: string): string {
  const c = (name ?? '').trim().charAt(0);
  return c ? c.toUpperCase() : '?';
}

/**
 * Remote avatar with a graceful fallback. Shows an initial-letter placeholder
 * when the uri is missing OR the image fails to load (e.g. an expired Supabase
 * signed URL) — instead of a blank gray box. The failed flag is keyed to the
 * specific uri, so a list row reused with a new uri re-attempts the load.
 */
export default function Avatar({ uri, name, size, borderRadius = 0, style }: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const dims = { width: size, height: size, borderRadius };
  const failed = uri != null && uri === failedUri;

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, dims, style as StyleProp<ViewStyle>]}>
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>
          {initial(name)}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[dims, style]}
      onError={() => setFailedUri(uri)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { ...typography.title, color: colors.textSecondary, fontWeight: '600' },
});
