import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { currentUserId } from '../lib/session';

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
  const emit = (pos: Location.LocationObject) => {
    const c = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy ?? 0),
    };
    if (__DEV__) {
      // Dev aid: copy into seed_test_users(center_lat, center_lng) — lat first.
      console.log(`[anor] location fix → lat ${c.lat}, lng ${c.lng} (±${c.accuracy}m)`);
    }
    onCoords(c);
  };

  // Fast first paint from a recent cached fix, if there is one.
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    if (last) emit(last);
  } catch {}

  // Force an initial live fix too: getLastKnownPositionAsync is null on a fresh
  // install, and the watch below can be slow to deliver its first update when the
  // phone is stationary. Race against a timeout so we never hang on it.
  Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
  ])
    .then((pos) => {
      if (pos) emit(pos);
    })
    .catch(() => {});

  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15_000,
      // NO distanceInterval. On Android it maps to setSmallestDisplacement — a
      // movement FILTER — so a stationary phone gets NO updates and the feed
      // hangs on "Finding your location" forever (same trap backgroundPresence.ts
      // documents). Time-based heartbeat only.
      distanceInterval: 0,
    },
    emit,
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
  const userId = await currentUserId();
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
