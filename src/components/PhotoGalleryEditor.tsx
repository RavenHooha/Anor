import { useState } from 'react';
import { View, Text, Image, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, typography } from '../theme';
import { showDialog } from './AppDialog';
import { MAX_PHOTOS, uploadProfilePhoto } from '../storage/profile';

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
};

export default function PhotoGalleryEditor({ photos, onChange }: Props) {
  const [actionsFor, setActionsFor] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
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
      showDialog('Upload failed', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const removeAt = (index: number) => {
    showDialog('Remove this photo?', undefined, [
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

  const makeMain = (index: number) => {
    if (index === 0) return;
    const next = [photos[index], ...photos.filter((_, i) => i !== index)];
    onChange(next);
  };

  const onPhotoPress = (index: number) => {
    if (index === 0) {
      removeAt(index);
      return;
    }
    setActionsFor(index);
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
                onPress={() => onPhotoPress(i)}
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
        Tap a photo for options. Your main photo shows everywhere others see you.
      </Text>

      <Modal
        visible={actionsFor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActionsFor(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setActionsFor(null)} />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Photo options</Text>
          <View style={styles.sheetActions}>
            <Pressable
              onPress={() => {
                if (actionsFor !== null) makeMain(actionsFor);
                setActionsFor(null);
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnPrimary,
                pressed && styles.actionBtnPrimaryPressed,
              ]}
            >
              <Ionicons name="star" size={18} color={colors.background} />
              <Text style={styles.actionLabelPrimary}>Make main</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const idx = actionsFor;
                setActionsFor(null);
                if (idx !== null) removeAt(idx);
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnGhost,
                pressed && styles.actionBtnGhostPressed,
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={colors.primary} />
              <Text style={styles.actionLabelGhost}>Remove</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setActionsFor(null)}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
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

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  sheetTitle: { ...typography.title, fontSize: 18 },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnPrimaryPressed: { backgroundColor: colors.primaryDim },
  actionBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionBtnGhostPressed: { backgroundColor: colors.surfaceElevated },
  actionLabelPrimary: { color: colors.background, fontSize: 15, fontWeight: '600' },
  actionLabelGhost: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 14 },
});
