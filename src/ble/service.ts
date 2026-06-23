import { Platform } from 'react-native';
import type { EventSubscription } from 'react-native';
import BleManager, { BleState } from 'react-native-ble-manager';
import BLEAdvertiser from 'react-native-ble-advertiser';
import * as Sentry from '@sentry/react-native';
import { track } from '../lib/analytics';
import {
  ANOR_SERVICE_UUID,
  ANOR_COMPANY_ID,
  RSSI_WINDOW,
  RSSI_NEARBY_THRESHOLD,
  DEVICE_STALE_MS,
} from './constants';

export type SignalStrength = 'strong' | 'medium' | 'weak';

export type BleNearbyDevice = {
  id: string;
  rssi: number;
  signal: SignalStrength;
};

type Sample = { rssi: number; ts: number };

const samples = new Map<string, Sample[]>();
let listeners = new Set<(devices: BleNearbyDevice[]) => void>();
let scanSubscription: EventSubscription | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let started = false;
let advertising = false;

function rssiToSignal(rssi: number): SignalStrength {
  if (rssi >= -60) return 'strong';
  if (rssi >= -70) return 'medium';
  return 'weak';
}

function recordSample(id: string, rssi: number) {
  const arr = samples.get(id) ?? [];
  arr.push({ rssi, ts: Date.now() });
  while (arr.length > RSSI_WINDOW) arr.shift();
  samples.set(id, arr);
}

function snapshot(): BleNearbyDevice[] {
  const out: BleNearbyDevice[] = [];
  const now = Date.now();
  for (const [id, arr] of samples.entries()) {
    const last = arr[arr.length - 1]?.ts ?? 0;
    if (now - last > DEVICE_STALE_MS) {
      samples.delete(id);
      continue;
    }
    const avg = arr.reduce((a, b) => a + b.rssi, 0) / arr.length;
    if (avg < RSSI_NEARBY_THRESHOLD) continue;
    out.push({ id, rssi: avg, signal: rssiToSignal(avg) });
  }
  return out.sort((a, b) => b.rssi - a.rssi);
}

function broadcast() {
  for (const listener of listeners) listener(snapshot());
}

export async function startBle(): Promise<void> {
  if (started || Platform.OS !== 'android') return;
  started = true;

  try {
    await BleManager.start({ showAlert: false });
  } catch (e) {
    started = false;
    throw e;
  }

  // Advertise: be discoverable as an Anor device.
  try {
    BLEAdvertiser.setCompanyId(ANOR_COMPANY_ID);
    await BLEAdvertiser.broadcast(ANOR_SERVICE_UUID, [], {
      includeDeviceName: false,
      includeTxPowerLevel: false,
      connectable: false,
    });
    advertising = true;
  } catch (e) {
    // Advertising can fail on devices that don't support peripheral mode.
    // Scan still works — but this failure was previously invisible, so the
    // app looked like it was working while being undiscoverable. Surface it:
    // a Sentry breadcrumb for debugging and an anonymous opt-in event so we
    // can see how often advertising fails in the field.
    Sentry.captureException(e, { tags: { area: 'ble', op: 'advertise' } });
    track('ble_advertise_failed');
  }

  // Scan: listen for other Anor devices via ble-manager's typed event helper.
  scanSubscription = BleManager.onDiscoverPeripheral((data) => {
    if (typeof data?.rssi !== 'number' || !data?.id) return;
    recordSample(data.id, data.rssi);
  });

  // seconds=0 = scan until stopScan(); allowDuplicates so RSSI updates flow per peripheral (iOS only flag, harmless on Android)
  await BleManager.scan({
    serviceUUIDs: [ANOR_SERVICE_UUID],
    seconds: 0,
    allowDuplicates: true,
  });

  pollInterval = setInterval(broadcast, 1500);
}

export async function stopBle(): Promise<void> {
  if (!started) return;
  started = false;

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (scanSubscription) {
    scanSubscription.remove();
    scanSubscription = null;
  }
  try {
    await BleManager.stopScan();
  } catch {}
  if (advertising) {
    try {
      await BLEAdvertiser.stopBroadcast();
    } catch {}
    advertising = false;
  }
  samples.clear();
  broadcast();
}

export function subscribeNearby(
  listener: (devices: BleNearbyDevice[]) => void,
): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Prompt the user to turn Bluetooth on (Android shows the system enable dialog).
 * No-op on other platforms. If declined, the state observer keeps watching, so
 * enabling it manually later still resumes scanning.
 */
export async function enableBluetooth(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await BleManager.enableBluetooth();
  } catch {
    // User declined or the OS rejected — nothing to do; observer handles resume.
  }
}

/**
 * Observe the Bluetooth adapter state (Android only). Calls back immediately
 * with the current state and again on every toggle. Without this, scanning
 * silently does nothing when Bluetooth is off — the app reports 'scanning'
 * while the feed stays permanently empty with no prompt to fix it.
 */
export function observeBleState(cb: (on: boolean) => void): () => void {
  if (Platform.OS !== 'android') return () => {};
  const sub = BleManager.onDidUpdateState((event) => {
    cb(event.state === BleState.On);
  });
  // Ensure the manager is started (idempotent) so state events flow, then force
  // an initial emission — checkState() also triggers onDidUpdateState.
  BleManager.start({ showAlert: false })
    .then(() => BleManager.checkState())
    .then((state) => cb(state === BleState.On))
    .catch(() => {});
  return () => sub.remove();
}
