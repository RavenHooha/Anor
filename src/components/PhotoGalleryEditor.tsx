import { View, Text, Image, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, typography } from '../theme';
import { MAX_PHOTOS, uploadProfilePhoto } from '../storage/profile';

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
};

export default function PhotoGalleryEditor({ photos, onChange }: Props) {
  const slots: (string | null)[] = [];
  for (let i = 0; i < MAX_PHOTOS; i += 1) {
    slots.push(photos[i] ?? null);
  }

  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const url = await uploadProfilePhoto(result.assets[0].uri);
      onChange([...photos, url]);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const removeAt = (index: number) => {
    Alert.alert('Remove this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const next = photos.filter((_, i) => i !== index);
          onChange(next);
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.counter}>
        {photos.length} of {MAX_PHOTOS} photos
      </Text>
      <View style={styles.grid}>
        {slots.map((url, i) => (
          <View key={i} style={styles.slot}>
            {url ? (
              <Pressable
                onPress={() => removeAt(i)}
                style={styles.slotInner}
              >
                <Image source={{ uri: url }} style={styles.slotImage} />
                <View style={styles.removeBadge}>
                  <Ionicons name="close" size={14} color={colors.background} />
                </View>
                {i === 0 && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryLabel}>Main</Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={addPhoto}
                style={({ pressed }) => [
                  styles.slotInner,
                  styles.slotEmpty,
                  pressed && styles.slotEmptyPressed,
                ]}
              >
                <Ionicons name="add" size={32} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <Text style={styles.hint}>
        Tap a photo to remove. First photo is your main one.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  counter: { ...typography.caption, color: colors.textMuted },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slot: {
    width: '48%',
    aspectRatio: 1,
  },
  slotInner: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  slotEmptyPressed: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  slotImage: { width: '100%', height: '100%' },
  removeBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  primaryLabel: { color: colors.background, fontSize: 10, fontWeight: '700' },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
