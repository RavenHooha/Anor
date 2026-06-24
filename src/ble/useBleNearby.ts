import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  startBle,
  stopBle,
  subscribeNearby,
  observeBleState,
  type BleNearbyDevice,
} from './service';
import { requestBlePermissions, type BlePermissionsResult } from './permissions';

export type BleStatus =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'denied'
  | 'unsupported'
  | 'error'
  | 'bluetoothOff';

export function useBleNearby(): {
  status: BleStatus;
  devices: BleNearbyDevice[];
  retry: () => void;
} {
  const [status, setStatus] = useState<BleStatus>('idle');
  const [devices, setDevices] = useState<BleNearbyDevice[]>([]);
  const startedRef = useRef(false);
  const startingRef = useRef(false);
  const permsOkRef = useRef(false);
  // Assume the adapter is on until the state observer tells us otherwise, so a
  // normal (Bluetooth-on) cold start scans immediately without waiting on it.
  const bleOnRef = useRef(true);

  const begin = async () => {
    if (Platform.OS !== 'android') {
      setStatus('unsupported');
      return;
    }
    // Guard against overlapping starts (e.g. the adapter-on event firing while
    // a cold-start begin() is still awaiting permissions).
    if (startingRef.current || startedRef.current) return;
    startingRef.current = true;
    try {
      setStatus('requesting');
      let perm: BlePermissionsResult;
      try {
        perm = await requestBlePermissions();
      } catch {
        setStatus('error');
        return;
      }
      if (perm !== 'granted') {
        permsOkRef.current = false;
        setStatus(perm === 'unsupported' ? 'unsupported' : 'denied');
        return;
      }
      permsOkRef.current = true;
      if (!bleOnRef.current) {
        setStatus('bluetoothOff');
        return;
      }
      try {
        await startBle();
        // The adapter may have flipped off while we were starting — don't claim
        // to be scanning if so.
        if (!bleOnRef.current) {
          await stopBle().catch(() => {});
          setStatus('bluetoothOff');
          return;
        }
        startedRef.current = true;
        setStatus('scanning');
      } catch {
        setStatus('error');
      }
    } finally {
      startingRef.current = false;
    }
  };

  useEffect(() => {
    const unsub = subscribeNearby(setDevices);

    // React to the Bluetooth adapter being toggled — the fix for the silent
    // "BT off → permanently empty feed" failure.
    const unsubState = observeBleState((on) => {
      bleOnRef.current = on;
      if (!on) {
        if (startedRef.current) {
          stopBle().catch(() => {});
          startedRef.current = false;
        }
        // Don't mask a denied/unsupported state with bluetoothOff.
        setStatus((s) => (s === 'denied' || s === 'unsupported' ? s : 'bluetoothOff'));
      } else if (
        permsOkRef.current &&
        !startedRef.current &&
        AppState.currentState === 'active'
      ) {
        // Bluetooth came back on while we're foregrounded and permitted — resume.
        begin();
      }
    });

    begin();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (startedRef.current) {
          stopBle().catch(() => {});
          startedRef.current = false;
        }
      } else if (state === 'active' && !startedRef.current) {
        begin();
      }
    });

    return () => {
      unsub();
      unsubState();
      sub.remove();
      if (startedRef.current) {
        stopBle().catch(() => {});
        startedRef.current = false;
      }
    };
     
  }, []);

  return { status, devices, retry: begin };
}
