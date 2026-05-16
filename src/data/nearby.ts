import { supabase } from '../lib/supabase';
import type { Status } from '../types/status';
import type { NearbyUser } from '../types/user';
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

  return (data as RpcRow[])
    .filter((r) => r.status !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      photoUrl: r.photo_url ?? '',
      photos: Array.isArray(r.photos) ? r.photos : [],
      bio: r.bio ?? '',
      interests: Array.isArray(r.interests) ? r.interests : [],
      age: typeof r.age === 'number' ? r.age : null,
      status: r.status as Status,
      distanceM: r.distance_m,
    }));
}

type RpcRow = {
  id: string;
  name: string;
  photo_url: string | null;
  photos: string[] | null;
  bio: string | null;
  interests: string[] | null;
  age: number | null;
  status: string | null;
  distance_m: number;
};
