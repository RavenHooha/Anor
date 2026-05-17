import { Platform } from 'react-native';
import type { EventSubscription } from 'react-native';
import BleManager from 'react-native-ble-manager';
import BLEAdvertiser from 'react-native-ble-advertiser';
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
  } catch {
    // Advertising can fail on devices that don't support peripheral mode.
    // Scan still works.
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
