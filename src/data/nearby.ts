import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import type { Status } from '../types/status';
import type { NearbyUser } from '../types/user';
import type { SubscriptionTier } from '../types/subscription';
import type { LocationCoords } from '../location/location';

export type RadiusPreset = {
  id: 'here' | 'walking' | 'city' | 'region' | 'country';
  label: string;
  meters: number;
};

export const RADIUS_PRESETS: readonly RadiusPreset[] = [
  { id: 'here', label: 'Here', meters: 200 },
  { id: 'walking', label: 'Walking', meters: 1_000 },
  { id: 'city', label: 'City', meters: 25_000 },
  { id: 'region', label: 'Region', meters: 250_000 },
  { id: 'country', label: 'Country', meters: 5_000_000 },
] as const;

export const DEFAULT_RADIUS_M = RADIUS_PRESETS[0].meters;

export async function fetchNearby(
  coords: LocationCoords,
  radiusM: number = DEFAULT_RADIUS_M,
): Promise<NearbyUser[]> {
  const { data, error } = await supabase.rpc('nearby', {
    my_location: `POINT(${coords.lng} ${coords.lat})`,
    radius_m: radiusM,
  });

  if (error) throw error;
  if (!data) return [];

  return data.filter((r) => r.status !== null).map(mapRow);
}

/**
 * People confirmed at the same seeded venue as me right now, open to connect.
 * Returns the venue name (from the first row) and the mapped users. Empty when
 * I'm not checked in anywhere. distance is meaningless here (same venue), so the
 * UI hides it. See migration 0038/0039.
 */
export async function fetchCopresence(): Promise<{
  venue: string | null;
  users: NearbyUser[];
}> {
  const { data, error } = await supabase.rpc('venue_copresence');
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return { venue: null, users: [] };
  return {
    venue: rows[0]?.venue ?? null,
    users: rows.filter((r) => r.status !== null).map(mapRow),
  };
}

/**
 * My own current seeded-venue check-in, for the "Checked in at {venue}" UI.
 * Swallows errors (returns not-confirmed) so a missing RPC never breaks the
 * rest of the feed load.
 */
export async function fetchMyCheckin(): Promise<{
  venueName: string | null;
  confirmed: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('my_checkin');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      venueName: row?.venue_name ?? null,
      confirmed: !!row?.dwell_confirmed,
    };
  } catch {
    return { venueName: null, confirmed: false };
  }
}

function mapRow(r: NearbyRow): NearbyUser {
  return {
    id: r.id,
    name: r.name,
    photoUrl: r.photo_url ?? '',
    photos: Array.isArray(r.photos) ? r.photos : [],
    bio: r.bio ?? '',
    interests: Array.isArray(r.interests) ? r.interests : [],
    connectPrefs: Array.isArray(r.connect_prefs) ? r.connect_prefs : [],
    age: typeof r.age === 'number' ? r.age : null,
    venue: r.venue ?? null,
    status: r.status as Status,
    distanceM: r.distance_m,
    createdAt: r.created_at ?? null,
    supporter: {
      tier: (r.tier as SubscriptionTier | null) ?? null,
      isFounding: r.is_founding === true,
      accentColor: r.accent_color ?? null,
      profileTheme: r.profile_theme ?? null,
      profileBackground: r.profile_background ?? null,
    },
  };
}

// Both nearby() and venue_copresence() return this same shape; type the mapper
// from the generated schema so a column rename breaks the build here.
type NearbyRow = Database['public']['Functions']['nearby']['Returns'][number];
