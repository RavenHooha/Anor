import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  startBle,
  stopBle,
  subscribeNearby,
  type BleNearbyDevice,
} from './service';
import { requestBlePermissions, type BlePermissionsResult } from './permissions';

export type BleStatus = 'idle' | 'requesting' | 'scanning' | 'denied' | 'unsupported' | 'error';

export function useBleNearby(): {
  status: BleStatus;
  devices: BleNearbyDevice[];
  retry: () => void;
} {
  const [status, setStatus] = useState<BleStatus>('idle');
  const [devices, setDevices] = useState<BleNearbyDevice[]>([]);
  const startedRef = useRef(false);

  const begin = async () => {
    if (Platform.OS !== 'android') {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    let perm: BlePermissionsResult;
    try {
      perm = await requestBlePermissions();
    } catch {
      setStatus('error');
      return;
    }
    if (perm !== 'granted') {
      setStatus(perm === 'unsupported' ? 'unsupported' : 'denied');
      return;
    }
    try {
      await startBle();
      startedRef.current = true;
      setStatus('scanning');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    const unsub = subscribeNearby(setDevices);
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
      sub.remove();
      if (startedRef.current) {
        stopBle().catch(() => {});
        startedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, devices, retry: begin };
}
