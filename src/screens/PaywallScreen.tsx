import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { colors, spacing, radius, typography } from '../theme';
import { purchasesEnabled } from '../lib/purchases';
import { TIER_BY_ID, type SubscriptionTier } from '../types/subscription';

function tierFromProductId(id: string): SubscriptionTier | null {
  const s = id.toLowerCase();
  if (s.includes('benefactor')) return 'benefactor';
  if (s.includes('patron')) return 'patron';
  if (s.includes('supporter')) return 'supporter';
  return null;
}

type Phase = 'loading' | 'ready' | 'unavailable' | 'done';

export default function PaywallScreen() {
  const navigation = useNavigation();
  const [phase, setPhase] = useState<Phase>('loading');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!purchasesEnabled()) {
          if (!cancelled) setPhase('unavailable');
          return;
        }
        try {
          const offerings = await Purchases.getOfferings();
          const current = offerings.current;
          if (cancelled) return;
          if (!current || current.availablePackages.length === 0) {
            setPhase('unavailable');
            return;
          }
          setPackages(current.availablePackages);
          setPhase('ready');
        } catch {
          if (!cancelled) setPhase('unavailable');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const buy = async (pkg: PurchasesPackage) => {
    if (buying) return;
    setBuying(pkg.identifier);
    setError(null);
    try {
      await Purchases.purchasePackage(pkg);
      setPhase('done');
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) {
        setError(err.message ?? 'Purchase failed. Please try again.');
      }
    } finally {
      setBuying(null);
    }
  };

  const restore = async () => {
    setError(null);
    try {
      await Purchases.restorePurchases();
      setPhase('done');
    } catch {
      setError('Nothing to restore.');
    }
  };

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'done') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="sunny" size={48} color={colors.highlight} />
          <Text style={styles.doneTitle}>Thank you.</Text>
          <Text style={styles.doneBody}>
            You're a supporter. Your perks unlock shortly — head to Personalize
            to make your profile yours.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.primaryLabel}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'unavailable') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.doneTitle}>Not available yet</Text>
          <Text style={styles.doneBody}>
            Supporting Anor isn't available on this build yet. Check back soon.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Support Anor</Text>
        <Text style={styles.sub}>
          Anor is free. If you want to back it — and the housing mission behind
          it — pick a tier and get a few cosmetic touches as thanks.
        </Text>

        {packages.map((pkg) => {
          const tier = tierFromProductId(pkg.product.identifier);
          const cfg = tier ? TIER_BY_ID[tier] : null;
          return (
            <View key={pkg.identifier} style={styles.tierCard}>
              <View style={styles.tierHead}>
                <Text style={styles.tierName}>
                  {cfg?.label ?? pkg.product.title}
                </Text>
                <Text style={styles.tierPrice}>{pkg.product.priceString}/mo</Text>
              </View>
              {cfg && <Text style={styles.tierBlurb}>{cfg.blurb}</Text>}
              <Pressable
                onPress={() => buy(pkg)}
                disabled={!!buying}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.8 },
                  buying === pkg.identifier && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.primaryLabel}>
                  {buying === pkg.identifier ? 'Processing…' : 'Become a supporter'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable onPress={restore} style={styles.restoreBtn}>
          <Text style={styles.restoreLabel}>Restore purchases</Text>
        </Pressable>

        <Text style={styles.fineprint}>
          Billed monthly through Google Play. Cancel anytime in Play Store →
          Subscriptions. 100% of net profit goes to housing.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  content: { padding: spacing.lg, gap: spacing.md },
  heading: { ...typography.display, fontSize: 28, color: colors.textPrimary },
  sub: { ...typography.body, color: colors.textSecondary },
  tierCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierName: { ...typography.title, fontSize: 19 },
  tierPrice: { ...typography.title, fontSize: 17, color: colors.highlight },
  tierBlurb: { ...typography.caption, color: colors.textSecondary },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryLabel: { color: colors.background, fontSize: 15, fontWeight: '700' },
  restoreBtn: { alignSelf: 'center', paddingVertical: spacing.sm },
  restoreLabel: { ...typography.caption, color: colors.secondary, fontWeight: '600' },
  error: { ...typography.caption, color: colors.primary, textAlign: 'center' },
  fineprint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  doneTitle: { ...typography.title, color: colors.textPrimary },
  doneBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
