import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { LocationCoords } from '../location/location';

// Must match TILE_DEG in supabase/functions/_shared/osm.ts — the client only
// uses it to avoid re-invoking the backfill for a tile it already triggered.
const TILE_DEG = 0.02;
const LAST_TILE_KEY = 'anor.venues.lastEnsuredTile';

function tileKey(lat: number, lng: number): string {
  return `${Math.floor(lng / TILE_DEG)}_${Math.floor(lat / TILE_DEG)}`;
}

/**
 * Ask the backfill-venues function to populate the user's current map tile from
 * OpenStreetMap (Strategy B). Server-side caching means a given tile only hits
 * Overpass once per refresh window across all users; this client throttle just
 * avoids re-invoking for a tile we already triggered. Returns true when new
 * venues were likely added, so the caller can refresh the list.
 */
export async function ensureVenuesNearby(coords: LocationCoords): Promise<boolean> {
  const key = tileKey(coords.lat, coords.lng);
  try {
    if ((await AsyncStorage.getItem(LAST_TILE_KEY)) === key) return false;
  } catch {
    // best-effort; fall through and invoke
  }
  try {
    const { data, error } = await supabase.functions.invoke('backfill-venues', {
      body: { lat: coords.lat, lng: coords.lng },
    });
    if (error) return false; // network/function error — don't cache, allow retry
    if (data?.unavailable) return false; // Overpass busy — retry on a later load
    try {
      await AsyncStorage.setItem(LAST_TILE_KEY, key);
    } catch {
      // best-effort
    }
    return (data?.added ?? 0) > 0;
  } catch {
    return false;
  }
}

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
  return data.map((r) => ({
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
