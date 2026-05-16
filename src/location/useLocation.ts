import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  watchLocation,
  pushPresenceLocation,
  requestLocationPermission,
  type LocationCoords,
  type LocationPermissionResult,
} from './location';

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'tracking'
  | 'denied'
  | 'error';

export function useLocation(): {
  status: LocationStatus;
  coords: LocationCoords | null;
  retry: () => void;
} {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const stop = () => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  };

  const begin = async () => {
    stop();
    setStatus('requesting');
    let perm: LocationPermissionResult;
    try {
      perm = await requestLocationPermission();
    } catch {
      setStatus('error');
      return;
    }
    if (perm !== 'granted') {
      setStatus('denied');
      return;
    }
    try {
      const unsub = await watchLocation((c) => {
        setCoords(c);
        pushPresenceLocation(c).catch(() => {});
      });
      unsubRef.current = unsub;
      setStatus('tracking');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    begin();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        stop();
      } else if (state === 'active' && !unsubRef.current) {
        begin();
      }
    });
    return () => {
      sub.remove();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, coords, retry: begin };
}
