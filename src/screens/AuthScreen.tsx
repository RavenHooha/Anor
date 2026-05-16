import { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import { sendMagicLink } from '../auth/deepLink';

type Phase = 'idle' | 'sending' | 'sent' | 'error';

const FEATURES = [
  {
    icon: 'flame-outline' as const,
    title: 'Intentional',
    body: 'Status broadcasts say how you’re showing up — Open, Connect, Focus, Spark.',
  },
  {
    icon: 'location-outline' as const,
    title: 'Right here, right now',
    body: 'See who’s within your block, walk, or country. No swiping into the void.',
  },
  {
    icon: 'chatbubbles-outline' as const,
    title: 'Real conversations',
    body: 'Wave or open with a single line. Chat unlocks when both sides reply.',
  },
];

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const valid = /\S+@\S+\.\S+/.test(email.trim());

  const onSend = async () => {
    if (!valid || phase === 'sending') return;
    setPhase('sending');
    setError(null);
    try {
      await sendMagicLink(email.trim());
      setPhase('sent');
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Could not send link.');
    }
  };

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
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Ionicons name="flame" size={48} color={colors.primary} />
            </View>
            <Text style={styles.brand}>nigh</Text>
            <Text style={styles.tagline}>Real connections. Made simple.</Text>
          </View>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureText}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.spacer} />

          {phase === 'sent' ? (
            <View style={styles.sentBox}>
              <Text style={styles.sentTitle}>Check your email.</Text>
              <Text style={typography.body}>
                We sent a sign-in link to{' '}
                <Text style={styles.bold}>{email.trim()}</Text>. Tap it on this
                device to come back here.
              </Text>
              <Pressable
                onPress={() => setPhase('idle')}
                style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.linkBtnText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="send"
                onSubmitEditing={onSend}
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable
                disabled={!valid || phase === 'sending'}
                onPress={onSend}
                style={({ pressed }) => [
                  styles.cta,
                  (!valid || phase === 'sending') && styles.ctaDisabled,
                  pressed && valid && phase !== 'sending' && styles.ctaPressed,
                ]}
              >
                <Text style={styles.ctaLabel}>
                  {phase === 'sending' ? 'Sending…' : 'Send sign-in link'}
                </Text>
              </Pressable>
              <Text style={styles.fineprint}>
                No passwords. We email you a one-tap sign-in link.
              </Text>
            </View>
          )}
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 38,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  features: { gap: spacing.md, marginTop: spacing.lg },
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureBody: { flex: 1, gap: 2 },
  featureTitle: {
    ...typography.title,
    fontSize: 16,
    color: colors.textPrimary,
  },
  featureText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  spacer: { flex: 1, minHeight: spacing.md },
  form: { gap: spacing.sm },
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
  errorText: { ...typography.caption, color: colors.primary },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryDim },
  ctaDisabled: { backgroundColor: colors.surfaceElevated },
  ctaLabel: { color: colors.background, fontSize: 16, fontWeight: '600' },
  fineprint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sentBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sentTitle: { ...typography.title, color: colors.primary },
  bold: { fontWeight: '600', color: colors.textPrimary },
  linkBtn: { paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  linkBtnText: { color: colors.secondary, fontSize: 15, fontWeight: '500' },
});
