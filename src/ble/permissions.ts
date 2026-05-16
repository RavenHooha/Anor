import { Platform, PermissionsAndroid } from 'react-native';

export type BlePermissionsResult = 'granted' | 'denied' | 'unsupported';

export async function requestBlePermissions(): Promise<BlePermissionsResult> {
  if (Platform.OS !== 'android') return 'unsupported';

  const apiLevel = Platform.Version as number;

  // Android 12+ (API 31+): runtime BLUETOOTH_SCAN/CONNECT/ADVERTISE
  if (apiLevel >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ]);
    const allGranted = Object.values(result).every(
      (s) => s === PermissionsAndroid.RESULTS.GRANTED,
    );
    return allGranted ? 'granted' : 'denied';
  }

  // Android 6–11: BLE scanning required ACCESS_FINE_LOCATION at runtime
  const fineLocation = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return fineLocation === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
}
