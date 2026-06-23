import { supabase } from '../lib/supabase';
import type { LocationCoords } from '../location/location';

// "Ping me when someone's around" — the cold-start retention hook. Armed from
// the empty feed; fires once (server-side cron) when an open-to-connect person
// shows up near the anchored spot, then disarms. See migration 0042.

export async function setNearbyAlert(
  coords: LocationCoords,
  radiusM: number,
): Promise<void> {
  const { error } = await supabase.rpc('set_nearby_alert', {
    p_lat: coords.lat,
    p_lng: coords.lng,
    p_radius: radiusM,
  });
  if (error) throw error;
}

export async function clearNearbyAlert(): Promise<void> {
  const { error } = await supabase.rpc('clear_nearby_alert');
  if (error) throw error;
}

export async function getNearbyAlert(): Promise<{
  active: boolean;
  radiusM: number;
} | null> {
  const { data, error } = await supabase.rpc('get_nearby_alert');
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { active: !!row.active, radiusM: row.radius_m };
}
