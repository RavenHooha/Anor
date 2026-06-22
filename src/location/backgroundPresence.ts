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
const DISCOVERABLE_PREF_KEY = 'anor.discoverable.pref';

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
  count: number; // total runs recorded
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

async function writeBreadcrumb(ok: boolean, msg: string): Promise<void> {
  try {
    const prev = await readBreadcrumb();
    const next: BgBreadcrumb = {
      at: new Date().toISOString(),
      ok,
      msg,
      count: (prev?.count ?? 0) + 1,
    };
    await AsyncStorage.setItem(BREADCRUMB_KEY, JSON.stringify(next));
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

// Must be defined in module/global scope so the OS can invoke it on cold start.
TaskManager.defineTask(BG_PRESENCE_TASK, async ({ data, error }) => {
  if (error) {
    await writeBreadcrumb(false, `task error: ${error.message}`);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  const pos = locations?.[locations.length - 1];
  if (!pos) {
    await writeBreadcrumb(false, 'task fired with no location');
    return;
  }

  const coords = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: Math.round(pos.coords.accuracy ?? 0),
  };

  const auth = await ensureAuthedUserId();
  if (!auth.id) {
    await writeBreadcrumb(false, `auth: ${auth.reason}`);
    return;
  }

  const result = await checkinPresence(coords);
  if ('error' in result) {
    await writeBreadcrumb(false, `checkin: ${result.error}`);
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
  await writeBreadcrumb(true, msg);
});

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
    distanceInterval: 50, // meters — coarse on purpose (battery + privacy)
    timeInterval: 120_000, // also ping ~every 2 min while stationary, so the
    // venue dwell clock keeps advancing when the user is sitting still
    deferredUpdatesInterval: 60_000,
    pausesUpdatesAutomatically: false,
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
