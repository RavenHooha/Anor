import AsyncStorage from '@react-native-async-storage/async-storage';

// Opt-in for the "Bluetooth proximity (beta)" mode — keep BLE scanning/advertising
// alive while Anor is backgrounded (Android only), instead of stopping it the
// moment the screen sleeps. Off by default; the user turns it on in Settings.
//
// Reliability is genuinely unknown across the Android device fleet, which is why
// it ships as a labelled beta — the opted-in cohort plus the BLE telemetry
// (ble_advertise_failed) tell us how well it actually holds in the field.
const KEY = 'anor.ble.background';

export async function getBleBackgroundPref(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setBleBackgroundPref(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // best-effort; defaults to off on read failure
  }
}
