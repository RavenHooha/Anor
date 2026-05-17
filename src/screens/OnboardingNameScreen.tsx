import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, typography } from '../theme';
import StepIndicator from '../components/StepIndicator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingName'>;

export default function OnboardingNameScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const pickPhoto = async () => {
    setPermissionError(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionError(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const canContinue = name.trim().length > 0 && !!photoUri && agreed;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <StepIndicator step={0} total={2} />

          <View style={styles.header}>
            <Text style={styles.title}>Hey there.</Text>
            <Text style={typography.body}>What should people call you?</Text>
          </View>

          <Pressable
            onPress={pickPhoto}
            style={({ pressed }) => [
              styles.photo,
              pressed && styles.photoPressed,
            ]}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
            ) : (
              <Text style={styles.photoPlaceholder}>+</Text>
            )}
          </Pressable>
          <Text style={styles.photoHint}>
            {photoUri ? 'Tap to change photo' : 'Add a photo'}
          </Text>
          {permissionError && (
            <Text style={styles.errorText}>
              Photo access denied. Enable it in Settings to continue.
            </Text>
          )}

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="done"
            maxLength={40}
          />

          <Pressable
            onPress={() => setAgreed(!agreed)}
            style={styles.tosRow}
            hitSlop={4}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && (
                <Ionicons name="checkmark" size={14} color={colors.background} />
              )}
            </View>
            <Text style={styles.tosText}>
              I'm 18 or older and agree to Anor's terms of use.
            </Text>
          </Pressable>

          <View style={styles.spacer} />

          <Pressable
            disabled={!canContinue}
            onPress={() =>
              navigation.navigate('OnboardingBio', { name: name.trim(), photoUri })
            }
            style={({ pressed }) => [
              styles.cta,
              !canContinue && styles.ctaDisabled,
              pressed && canContinue && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaLabel}>Continue</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'stretch',
    gap: spacing.md,
  },
  header: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  title: { ...typography.display, color: colors.primary },
  photo: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPressed: { borderColor: colors.primary },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: {
    color: colors.textMuted,
    fontSize: 48,
    fontWeight: '300',
    lineHeight: 52,
  },
  photoHint: {
    ...typography.caption,
    textAlign: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tosText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  spacer: { flex: 1 },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryDim },
  ctaDisabled: { backgroundColor: colors.surfaceElevated },
  ctaLabel: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
