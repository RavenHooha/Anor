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

// Profile backgrounds (patron+). Each renders a large, faint Anor sun
// watermark behind the profile in `hue`. Stored as the id in
// profiles.profile_background. null/'none' = no backdrop.
export type ProfileBackground = { id: string; label: string; hue: string };

export const PROFILE_BACKGROUNDS: readonly ProfileBackground[] = [
  { id: 'ember', label: 'Ember', hue: '#ff6b35' },
  { id: 'gold', label: 'Gold', hue: '#ffcf3f' },
  { id: 'rose', label: 'Rose', hue: '#ff5d8f' },
  { id: 'violet', label: 'Violet', hue: '#b57edc' },
  { id: 'sky', label: 'Sky', hue: '#5cc8ff' },
  { id: 'mint', label: 'Mint', hue: '#5bd6a6' },
] as const;

export const BACKGROUND_BY_ID: Record<string, ProfileBackground> =
  PROFILE_BACKGROUNDS.reduce(
    (acc, b) => {
      acc[b.id] = b;
      return acc;
    },
    {} as Record<string, ProfileBackground>,
  );

// Returns the background id if it's one of ours, else null.
export function validBackground(id: string | null | undefined): string | null {
  return id && BACKGROUND_BY_ID[id] ? id : null;
}
