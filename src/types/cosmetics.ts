// Cosmetic option catalogs for supporters. Stored values are the raw hex
// strings (profiles.accent_color), validated client-side against these lists.
// Accent tints the supporter's name across the app (own profile, cards,
// detail) — visible to others, so it's the highest-value cosmetic.

export type AccentColor = { id: string; label: string; color: string };

export const ACCENT_COLORS: readonly AccentColor[] = [
  { id: 'sunset', label: 'Sunset', color: '#ff6b35' },
  { id: 'coral', label: 'Coral', color: '#e8756a' },
  { id: 'amber', label: 'Amber', color: '#ffb347' },
  { id: 'gold', label: 'Gold', color: '#ffcf3f' },
  { id: 'rose', label: 'Rose', color: '#ff5d8f' },
  { id: 'violet', label: 'Violet', color: '#b57edc' },
  { id: 'sky', label: 'Sky', color: '#5cc8ff' },
  { id: 'mint', label: 'Mint', color: '#5bd6a6' },
] as const;

const ACCENT_SET = new Set(ACCENT_COLORS.map((a) => a.color));

// Only accept a stored accent if it's one of ours (defends rendering against
// stale/garbage values). null = use the default name color.
export function validAccent(color: string | null | undefined): string | null {
  return color && ACCENT_SET.has(color) ? color : null;
}
