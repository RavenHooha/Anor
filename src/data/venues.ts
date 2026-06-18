import { supabase } from '../lib/supabase';
import type { LocationCoords } from '../location/location';

// A venue surfaced in the nearby view, with its current live post (if any).
export type VenuePost = {
  id: string;
  kind: 'special' | 'event' | 'update';
  body: string;
  endsAt: string | null;
};

export type NearbyVenue = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  distanceM: number;
  post: VenuePost | null;
};

export async function fetchNearbyVenues(
  coords: LocationCoords,
  radiusM: number,
): Promise<NearbyVenue[]> {
  const { data, error } = await supabase.rpc('nearby_venues', {
    my_location: `POINT(${coords.lng} ${coords.lat})`,
    radius_m: radiusM,
  });
  if (error) throw error;
  if (!data) return [];
  return (data as RpcRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? null,
    address: r.address ?? null,
    distanceM: r.distance_m,
    post: r.post_id
      ? {
          id: r.post_id,
          kind: (r.post_kind as VenuePost['kind']) ?? 'special',
          body: r.post_body ?? '',
          endsAt: r.post_ends_at ?? null,
        }
      : null,
  }));
}

type RpcRow = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  distance_m: number;
  post_id: string | null;
  post_kind: string | null;
  post_body: string | null;
  post_ends_at: string | null;
};
