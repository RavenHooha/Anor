import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../theme';
import StepIndicator from '../components/StepIndicator';
import { uploadProfilePhoto, upsertMyProfile } from '../storage/profile';
import { track } from '../lib/analytics';
import { useProfileGate } from '../auth/profileGate';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingBio'>;

const BIO_LIMIT = 100;

export default function OnboardingBioScreen({ route }: Props) {
  const { name, photoUri } = route.params;
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshProfile } = useProfileGate();

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const photoUrl = photoUri ? await uploadProfilePhoto(photoUri) : null;
      await upsertMyProfile({ name, photoUrl, bio: bio.trim() });
      track('onboarding_completed');
      // App.tsx swaps the stack to Main once it sees the profile exists.
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <StepIndicator step={1} total={2} />

          <View style={styles.header}>
            <Text style={styles.title}>One line.</Text>
            <Text style={typography.body}>
              Something for people to know you by. Optional.
            </Text>
          </View>

          <TextInput
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, BIO_LIMIT))}
            placeholder="e.g. always down for a coffee."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={BIO_LIMIT}
          />
          <Text style={styles.counter}>
            {bio.length}/{BIO_LIMIT}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.spacer} />

          <Pressable
            disabled={saving}
            onPress={finish}
            style={({ pressed }) => [
              styles.cta,
              pressed && !saving && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaLabel}>
              {saving ? 'Saving…' : 'Get started'}
            </Text>
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
    gap: spacing.md,
  },
  header: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  title: { ...typography.display, color: colors.primary },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  counter: {
    ...typography.caption,
    textAlign: 'right',
  },
  spacer: { flex: 1 },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryDim },
  ctaLabel: { color: colors.background, fontSize: 16, fontWeight: '600' },
  errorText: { ...typography.caption, color: colors.primary },
});
