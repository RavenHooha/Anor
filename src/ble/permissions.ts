import { Platform, PermissionsAndroid } from 'react-native';

export type BlePermissionsResult = 'granted' | 'denied' | 'unsupported';

export async function requestBlePermissions(): Promise<BlePermissionsResult> {
  // iOS has no runtime BLE permission request — the system prompts automatically
  // on first CoreBluetooth use, gated by the NSBluetoothAlwaysUsageDescription
  // Info.plist string. Treat as granted and let the OS prompt; a denial surfaces
  // later as a non-"on" adapter state (handled as bluetoothOff).
  if (Platform.OS === 'ios') return 'granted';
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
