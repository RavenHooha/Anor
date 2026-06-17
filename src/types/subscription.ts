// Supporter subscription model — cosmetic-only, donation-style. Mirrors the
// 0033 migration. Tiers stack (each includes everything below). Monthly only.
//
// The DB (subscriptions table) is the source of truth for tier + founding
// status; it's written only by the billing webhook. This file is the
// client-side shape and the per-tier cosmetic entitlement map.

export type SubscriptionTier = 'supporter' | 'patron' | 'benefactor';

// Higher number = higher tier. Use tierAtLeast() for "is this tier >= X".
export const TIER_RANK: Record<SubscriptionTier, number> = {
  supporter: 1,
  patron: 2,
  benefactor: 3,
};

export type BadgeMetal = 'bronze' | 'silver' | 'gold';

export type TierConfig = {
  id: SubscriptionTier;
  label: string;
  priceUsd: number;
  priceLabel: string;
  // Cosmetic entitlements unlocked at this tier (cumulative via tierAtLeast).
  badge: BadgeMetal;
  badgeAnimated: boolean;
  themes: 'basic' | 'all'; // basic = a few presets; all = full set
  backgrounds: boolean; // profile background art
  statusStyling: boolean; // styled status line
  seasonalVariants: boolean; // rotating exclusive cosmetics
  blurb: string;
};

export const SUBSCRIPTION_TIERS: readonly TierConfig[] = [
  {
    id: 'supporter',
    label: 'Supporter',
    priceUsd: 2.99,
    priceLabel: '$2.99/mo',
    badge: 'bronze',
    badgeAnimated: false,
    themes: 'basic',
    backgrounds: false,
    statusStyling: false,
    seasonalVariants: false,
    blurb: 'Bronze sun badge, accent color, and a few profile themes.',
  },
  {
    id: 'patron',
    label: 'Patron',
    priceUsd: 4.99,
    priceLabel: '$4.99/mo',
    badge: 'silver',
    badgeAnimated: true,
    themes: 'all',
    backgrounds: true,
    statusStyling: true,
    seasonalVariants: false,
    blurb: 'Animated silver sun, every theme, profile backgrounds, status styling.',
  },
  {
    id: 'benefactor',
    label: 'Benefactor',
    priceUsd: 9.99,
    priceLabel: '$9.99/mo',
    badge: 'gold',
    badgeAnimated: true,
    themes: 'all',
    backgrounds: true,
    statusStyling: true,
    seasonalVariants: true,
    blurb: 'Glowing gold sun, exclusive rotating cosmetics, loudest founding flair.',
  },
] as const;

export const TIER_BY_ID: Record<SubscriptionTier, TierConfig> =
  SUBSCRIPTION_TIERS.reduce(
    (acc, t) => {
      acc[t.id] = t;
      return acc;
    },
    {} as Record<SubscriptionTier, TierConfig>,
  );

// True when `tier` is at least `min` in the stacking order.
export function tierAtLeast(
  tier: SubscriptionTier | null,
  min: SubscriptionTier,
): boolean {
  if (!tier) return false;
  return TIER_RANK[tier] >= TIER_RANK[min];
}

// The supporter state attached to a profile, as returned by get_public_profile
// / nearby(). null tier = not a supporter (cosmetics come back null too).
export type SupporterInfo = {
  tier: SubscriptionTier | null;
  isFounding: boolean;
  accentColor: string | null;
  profileTheme: string | null;
  profileBackground: string | null;
};

export const NO_SUPPORTER: SupporterInfo = {
  tier: null,
  isFounding: false,
  accentColor: null,
  profileTheme: null,
  profileBackground: null,
};
