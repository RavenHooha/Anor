import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../theme';
import {
  getMyProfile,
  upsertMyProfile,
} from '../storage/profile';
import InterestPicker from '../components/InterestPicker';
import ConnectPrefPicker from '../components/ConnectPrefPicker';
import SectionHeader from '../components/SectionHeader';
import PhotoGalleryEditor from '../components/PhotoGalleryEditor';
import LoadingScreen from '../components/LoadingScreen';
import { useProfileGate } from '../auth/profileGate';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const BIO_LIMIT = 100;

export default function EditProfileScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [ageText, setAgeText] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [connectPrefs, setConnectPrefs] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshProfile } = useProfileGate();

  useEffect(() => {
    getMyProfile().then((p) => {
      if (p) {
        setName(p.name);
        setBio(p.bio);
        setAgeText(p.age != null ? String(p.age) : '');
        setInterests(p.interests);
        setConnectPrefs(p.connectPrefs);
        setPhotos(p.photos.length > 0 ? p.photos : p.photoUrl ? [p.photoUrl] : []);
      }
      setLoaded(true);
    });
  }, []);

  const onSave = async () => {
    if (saving) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Name is required.');
      return;
    }
    let age: number | null = null;
    if (ageText.trim().length > 0) {
      const parsed = parseInt(ageText.trim(), 10);
      if (!Number.isFinite(parsed) || parsed < 13 || parsed > 120) {
        setError('Age must be a number between 13 and 120.');
        return;
      }
      age = parsed;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertMyProfile({ name: trimmed, bio: bio.trim(), photos, interests, connectPrefs, age });
      await refreshProfile();
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
      setSaving(false);
    }
  };

  if (!loaded) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Edit profile</Text>

          <Text style={styles.fieldLabel}>Photos</Text>
          <PhotoGalleryEditor photos={photos} onChange={setPhotos} />

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="words"
            maxLength={40}
          />

          <Text style={styles.fieldLabel}>Age</Text>
          <TextInput
            value={ageText}
            onChangeText={(t) => setAgeText(t.replace(/[^0-9]/g, '').slice(0, 3))}
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={3}
          />

          <Text style={styles.fieldLabel}>One line</Text>
          <TextInput
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, BIO_LIMIT))}
            placeholder="Something for people to know you by."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.bioInput]}
            multiline
            maxLength={BIO_LIMIT}
          />
          <Text style={styles.counter}>
            {bio.length}/{BIO_LIMIT}
          </Text>

          <View style={styles.sectionHeaderWrap}>
            <SectionHeader icon="sparkles-outline" label="Interests" accent={colors.highlight} />
          </View>
          <InterestPicker selected={interests} onChange={setInterests} />

          <View style={styles.sectionHeaderWrap}>
            <SectionHeader
              icon="chatbubble-ellipses-outline"
              label="How to connect with me"
              accent={colors.secondary}
            />
          </View>
          <Text style={styles.fieldHint}>
            Optional — take the guesswork out of how people reach you.
          </Text>
          <ConnectPrefPicker selected={connectPrefs} onChange={setConnectPrefs} />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.spacer} />

          <Pressable
            disabled={saving}
            onPress={onSave}
            style={({ pressed }) => [
              styles.cta,
              pressed && !saving && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaLabel}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: { ...typography.display, color: colors.primary, marginBottom: spacing.md },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  sectionHeaderWrap: { marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
  },
  bioInput: { minHeight: 88, textAlignVertical: 'top' },
  counter: { ...typography.caption, textAlign: 'right' },
  errorText: { ...typography.caption, color: colors.primary },
  spacer: { flex: 1, minHeight: spacing.lg },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryDim },
  ctaLabel: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
