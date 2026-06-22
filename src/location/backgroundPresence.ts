import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

// ---------------------------------------------------------------------------
// SPIKE GOAL: prove a headless background task can (1) read the persisted
// Supabase session from AsyncStorage, (2) refresh it without the foreground
// auto-refresh timer, and (3) write `presence`. Every run drops a breadcrumb
// so the foreground app can show a dead-clear pass/fail (see BackgroundDebug).
//
// If this works, it IS the real background-presence path — not throwaway.
// ---------------------------------------------------------------------------

export const BG_PRESENCE_TASK = 'anor-bg-presence';
const BREADCRUMB_KEY = 'anor.bgPresence.lastRun';
const LAST_BG_KEY = 'anor.bgPresence.lastBackground';
const DISCOVERABLE_PREF_KEY = 'anor.discoverable.pref';

export type CheckinSource = 'bg' | 'fg';

// The user's *intent* — separate from whether the OS task is currently alive.
// The toggle reflects this so it survives navigation and app restarts; the
// breadcrumb reflects the separate truth of whether the task is actually firing.
export async function getDiscoverablePref(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISCOVERABLE_PREF_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setDiscoverablePref(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(DISCOVERABLE_PREF_KEY, on ? '1' : '0');
  } catch {
    // best-effort
  }
}

export type BgBreadcrumb = {
  at: string; // ISO timestamp
  ok: boolean;
  msg: string;
  count: number; // total runs recorded (any source)
  source: CheckinSource;
};

// Separate record of the last *background* ping only — foreground re-checks
// (opening the app) never touch it, so it's a clean signal for "is the OS
// actually firing the task while the app is idle?".
export type LastBgRun = {
  at: string; // ISO timestamp
  count: number; // number of background pings recorded
};

async function readBreadcrumb(): Promise<BgBreadcrumb | null> {
  try {
    const raw = await AsyncStorage.getItem(BREADCRUMB_KEY);
    return raw ? (JSON.parse(raw) as BgBreadcrumb) : null;
  } catch {
    return null;
  }
}

export async function getBgBreadcrumb(): Promise<BgBreadcrumb | null> {
  return readBreadcrumb();
}

export async function getLastBgRun(): Promise<LastBgRun | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_BG_KEY);
    return raw ? (JSON.parse(raw) as LastBgRun) : null;
  } catch {
    return null;
  }
}

async function writeBreadcrumb(
  ok: boolean,
  msg: string,
  source: CheckinSource,
): Promise<void> {
  try {
    const prev = await readBreadcrumb();
    const next: BgBreadcrumb = {
      at: new Date().toISOString(),
      ok,
      msg,
      count: (prev?.count ?? 0) + 1,
      source,
    };
    await AsyncStorage.setItem(BREADCRUMB_KEY, JSON.stringify(next));

    // Track background pings separately so the idle test isn't muddied by
    // foreground re-checks.
    if (source === 'bg') {
      const prevBg = await getLastBgRun();
      const nextBg: LastBgRun = {
        at: next.at,
        count: (prevBg?.count ?? 0) + 1,
      };
      await AsyncStorage.setItem(LAST_BG_KEY, JSON.stringify(nextBg));
    }
  } catch {
    // Breadcrumb is best-effort; never let it crash the task.
  }
}

/**
 * Read the stored session and force a refresh if it's expired or about to be.
 * The foreground auto-refresh timer doesn't run in a headless task, so we do
 * it by hand. Returns the authed user id, or null if not signed in / refresh
 * failed (caller records the reason).
 */
async function ensureAuthedUserId(): Promise<{ id: string | null; reason: string }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { id: null, reason: `getSession error: ${error.message}` };

  const session = data.session;
  if (!session) return { id: null, reason: 'no stored session' };

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  const msUntilExpiry = expiresAtMs - Date.now();

  // Refresh if expired or within a 2-minute buffer.
  if (msUntilExpiry < 120_000) {
    const { data: refreshed, error: refreshErr } =
      await supabase.auth.refreshSession();
    if (refreshErr) {
      return { id: null, reason: `refresh failed: ${refreshErr.message}` };
    }
    const uid = refreshed.session?.user?.id ?? null;
    return { id: uid, reason: uid ? 'refreshed' : 'refresh returned no session' };
  }

  return { id: session.user.id, reason: 'session still valid' };
}

type CheckinResult = {
  venueName: string | null;
  confirmed: boolean;
};

// Write location AND advance the server-side venue dwell state in one call.
// Returns the current seeded venue + whether the 4-min dwell is confirmed, or
// an error string.
async function checkinPresence(
  coords: { lat: number; lng: number; accuracy: number },
): Promise<CheckinResult | { error: string }> {
  const { data, error } = await supabase.rpc('presence_checkin', {
    p_lat: coords.lat,
    p_lng: coords.lng,
    p_accuracy: coords.accuracy,
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    venueName: row?.venue_name ?? null,
    confirmed: !!row?.dwell_confirmed,
  };
}

// Shared by both the background task and the foreground "check now" path:
// authenticate, write location + advance the dwell state, drop a breadcrumb.
async function runCheckin(
  coords: { lat: number; lng: number; accuracy: number },
  source: CheckinSource,
): Promise<void> {
  const auth = await ensureAuthedUserId();
  if (!auth.id) {
    await writeBreadcrumb(false, `auth: ${auth.reason}`, source);
    return;
  }

  const result = await checkinPresence(coords);
  if ('error' in result) {
    await writeBreadcrumb(false, `checkin: ${result.error}`, source);
    return;
  }

  // Make the dwell state legible in the breadcrumb so it's testable on-device.
  let msg: string;
  if (result.confirmed) {
    msg = `checked in at ${result.venueName} (dwell ✓)`;
  } else if (result.venueName) {
    msg = `at ${result.venueName} — settling…`;
  } else {
    msg = `presence ok (${auth.reason}) — no venue`;
  }
  await writeBreadcrumb(true, msg, source);
}

// Must be defined in module/global scope so the OS can invoke it on cold start.
TaskManager.defineTask(BG_PRESENCE_TASK, async ({ data, error }) => {
  if (error) {
    await writeBreadcrumb(false, `task error: ${error.message}`, 'bg');
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  const pos = locations?.[locations.length - 1];
  if (!pos) {
    await writeBreadcrumb(false, 'task fired with no location', 'bg');
    return;
  }

  await runCheckin(
    {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy ?? 0),
    },
    'bg',
  );
});

/**
 * Force a check-in right now from the foreground — grabs a fresh fix and runs
 * the dwell evaluation immediately, instead of waiting for a background ping
 * (Android throttles stationary background location hard). Returns the updated
 * breadcrumb.
 */
export async function foregroundCheckin(): Promise<BgBreadcrumb | null> {
  try {
    // Fast path: a recent cached fix. getCurrentPositionAsync can hang for a
    // long time indoors waiting on a fresh GPS lock, so prefer last-known and
    // only fall back to a live fix with a hard timeout.
    let pos = await Location.getLastKnownPositionAsync({ maxAge: 180_000 });
    if (!pos) {
      pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
      ]);
    }
    if (!pos) {
      await writeBreadcrumb(false, 'check now: no location fix (timed out)', 'fg');
      return readBreadcrumb();
    }
    await runCheckin(
      {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy ?? 0),
      },
      'fg',
    );
  } catch (e) {
    await writeBreadcrumb(
      false,
      `check now: ${e instanceof Error ? e.message : 'failed'}`,
      'fg',
    );
  }
  return readBreadcrumb();
}

export async function isBackgroundPresenceRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BG_PRESENCE_TASK);
  } catch {
    return false;
  }
}

/**
 * Request background-location permission and start the foreground-service
 * location updates that drive the task. Returns an error string on failure.
 */
export async function startBackgroundPresence(): Promise<string | null> {
  // Check the current grant before re-requesting. On Android the background
  // request bounces the user out to system Settings and resolves as "denied"
  // before they pick "Allow all the time" — so a fresh request right after
  // granting reads stale. getXPermissions reads the real current state.
  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    fg = await Location.requestForegroundPermissionsAsync();
  }
  if (fg.status !== 'granted') return 'foreground location denied';

  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    bg = await Location.requestBackgroundPermissionsAsync();
  }
  if (bg.status !== 'granted') {
    return 'set Location to "Allow all the time" in system settings, then flip this again';
  }

  if (await isBackgroundPresenceRunning()) return null;

  await Location.startLocationUpdatesAsync(BG_PRESENCE_TASK, {
    accuracy: Location.Accuracy.Balanced,
    // CRITICAL: no distanceInterval. On Android that maps to setSmallestDisplacement,
    // a movement FILTER — with it set, a stationary phone (0 m moved) gets NO
    // updates regardless of timeInterval, so the dwell clock never advances while
    // you sit at a venue. Time-only heartbeat is what makes passive dwell work.
    timeInterval: 150_000, // ~2.5 min heartbeat, moving or still
    distanceInterval: 0,
    pausesUpdatesAutomatically: false, // iOS: don't auto-pause when stationary
    activityType: Location.ActivityType.Other, // iOS
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'Anor is discoverable',
      notificationBody: "Letting nearby people know you're open to connect.",
      notificationColor: colors.primary,
    },
  });

  return null;
}

export async function stopBackgroundPresence(): Promise<void> {
  if (await isBackgroundPresenceRunning()) {
    await Location.stopLocationUpdatesAsync(BG_PRESENCE_TASK);
  }
}
