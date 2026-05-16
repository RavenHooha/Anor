import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export type LocationCoords = {
  lat: number;
  lng: number;
  accuracy: number;
};

export type LocationPermissionResult = 'granted' | 'denied' | 'unsupported';

export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * Subscribe to position updates. Returns an unsubscribe function.
 * Calls `onCoords` whenever a new fix arrives (immediately if one is cached).
 * More reliable than getCurrentPositionAsync on Android emulators, where SET LOCATION
 * only delivers to currently-subscribed listeners.
 */
export async function watchLocation(
  onCoords: (c: LocationCoords) => void,
): Promise<() => void> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    if (last) {
      onCoords({
        lat: last.coords.latitude,
        lng: last.coords.longitude,
        accuracy: Math.round(last.coords.accuracy ?? 0),
      });
    }
  } catch {}

  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30_000,
      distanceInterval: 20,
    },
    (pos) => {
      onCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy ?? 0),
      });
    },
  );

  return () => sub.remove();
}

export type AreaNames = {
  city: string | null;
  region: string | null;
  country: string | null;
};

export async function reverseGeocodeArea(coords: LocationCoords): Promise<AreaNames> {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lng,
    });
    const r = results[0];
    if (!r) return { city: null, region: null, country: null };
    return {
      city: r.city ?? r.subregion ?? null,
      region: r.region ?? null,
      country: r.country ?? null,
    };
  } catch {
    return { city: null, region: null, country: null };
  }
}

export async function pushPresenceLocation(coords: LocationCoords): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const wkt = `POINT(${coords.lng} ${coords.lat})`;
  await supabase
    .from('presence')
    .upsert(
      {
        user_id: userId,
        location: wkt,
        accuracy_m: coords.accuracy,
      },
      { onConflict: 'user_id' },
    );
}
