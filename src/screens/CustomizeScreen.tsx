import { useCallback, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import {
  ACCENT_COLORS,
  PROFILE_BACKGROUNDS,
  validAccent,
  validBackground,
} from '../types/cosmetics';
import {
  TIER_BY_ID,
  tierAtLeast,
  type SupporterInfo,
  NO_SUPPORTER,
} from '../types/subscription';
import {
  getMyProfile,
  getMySupporter,
  setProfileCosmetics,
} from '../storage/profile';
import SupporterBadge from '../components/SupporterBadge';
import ProfileBackground from '../components/ProfileBackground';
import LoadingScreen from '../components/LoadingScreen';

export default function CustomizeScreen() {
  const [name, setName] = useState('You');
  const [supporter, setSupporter] = useState<SupporterInfo>(NO_SUPPORTER);
  const [accent, setAccent] = useState<string | null>(null);
  const [bg, setBg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getMyProfile(), getMySupporter()]).then(([p, s]) => {
        if (cancelled) return;
        if (p?.name) setName(p.name);
        setSupporter(s);
        setAccent(validAccent(s.accentColor));
        setBg(validBackground(s.profileBackground));
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const pickAccent = async (color: string | null) => {
    if (saving) return;
    const prev = accent;
    setAccent(color); // optimistic
    setSaving(true);
    try {
      await setProfileCosmetics({ accentColor: color });
    } catch {
      setAccent(prev); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  const pickBackground = async (id: string | null) => {
    if (saving) return;
    const prev = bg;
    setBg(id); // optimistic
    setSaving(true);
    try {
      await setProfileCosmetics({ profileBackground: id });
    } catch {
      setBg(prev); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <LoadingScreen />;

  // Not a supporter → gate. (Once billing exists this points at the paywall.)
  if (!supporter.tier) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.gate}>
          <Ionicons name="color-palette-outline" size={40} color={colors.primary} />
          <Text style={styles.gateTitle}>A supporter perk</Text>
          <Text style={styles.gateBody}>
            Personalizing your profile is part of supporting Anor. Become a
            supporter to pick your accent color and more.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const nameColor = accent ?? colors.textPrimary;
  const canBackground = tierAtLeast(supporter.tier, 'patron');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ProfileBackground id={bg} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Live preview */}
        <View style={styles.preview}>
          <View style={styles.previewNameRow}>
            <Text style={[styles.previewName, { color: nameColor }]} numberOfLines={1}>
              {name}
            </Text>
            <SupporterBadge tier={supporter.tier} size={24} />
          </View>
          <Text style={styles.previewLabel}>
            {TIER_BY_ID[supporter.tier].label} supporter
          </Text>
        </View>

        <Text style={styles.section}>Accent color</Text>
        <Text style={styles.sectionHint}>Tints your name across Anor.</Text>
        <View style={styles.swatches}>
          {/* Default / none */}
          <Pressable onPress={() => pickAccent(null)} style={styles.swatch}>
            <View
              style={[
                styles.swatchInner,
                styles.swatchDefault,
                accent === null && styles.swatchInnerSelected,
              ]}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.swatchLabel}>Default</Text>
          </Pressable>

          {ACCENT_COLORS.map((a) => (
            <Pressable key={a.id} onPress={() => pickAccent(a.color)} style={styles.swatch}>
              <View
                style={[
                  styles.swatchInner,
                  { backgroundColor: a.color },
                  accent === a.color && styles.swatchInnerSelected,
                ]}
              >
                {accent === a.color && (
                  <Ionicons name="checkmark" size={18} color={colors.background} />
                )}
              </View>
              <Text style={styles.swatchLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Background — patron and up */}
        <Text style={styles.section}>Profile backdrop</Text>
        {canBackground ? (
          <>
            <Text style={styles.sectionHint}>
              A faint sun glow behind your profile.
            </Text>
            <View style={styles.swatches}>
              <Pressable onPress={() => pickBackground(null)} style={styles.swatch}>
                <View
                  style={[
                    styles.swatchInner,
                    styles.swatchDefault,
                    bg === null && styles.swatchInnerSelected,
                  ]}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </View>
                <Text style={styles.swatchLabel}>None</Text>
              </Pressable>

              {PROFILE_BACKGROUNDS.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => pickBackground(b.id)}
                  style={styles.swatch}
                >
                  <View
                    style={[
                      styles.swatchInner,
                      styles.swatchDefault,
                      bg === b.id && styles.swatchInnerSelected,
                    ]}
                  >
                    <Image
                      source={require('../../assets/logo.png')}
                      style={{ width: 40, height: 40, tintColor: b.hue, opacity: 0.85 }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.swatchLabel}>{b.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.sectionHint}>
            Profile backdrops unlock at the Patron tier.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SWATCH = 56;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  gateTitle: { ...typography.title, color: colors.textPrimary },
  gateBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  preview: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  previewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewName: { ...typography.title, fontSize: 24 },
  previewLabel: { ...typography.caption, color: colors.highlight, fontWeight: '600' },
  section: { ...typography.title, fontSize: 17, marginTop: spacing.md },
  sectionHint: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  swatch: { alignItems: 'center', gap: 4, width: SWATCH },
  swatchInner: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchInnerSelected: {
    borderColor: colors.textPrimary,
  },
  swatchDefault: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  swatchLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
});
