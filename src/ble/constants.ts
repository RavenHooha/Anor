// 128-bit service UUID broadcast by all Anor devices.
// Random v4 UUID, fixed for the app forever.
export const EMBER_SERVICE_UUID = '7e1f8c2a-3b9d-4f6a-9c5e-8d2a1b3c4d5e';

// Manufacturer ID used when advertising. 0xFFFF is reserved by the
// Bluetooth SIG for testing/development — fine for prototypes.
export const EMBER_COMPANY_ID = 0xffff;

// Devices below this average RSSI are not considered "nearby".
// -75 dBm ≈ same room.
export const RSSI_NEARBY_THRESHOLD = -75;

// How many RSSI samples to average per device.
export const RSSI_WINDOW = 5;

// Drop devices not seen for this long (ms).
export const DEVICE_STALE_MS = 10_000;
