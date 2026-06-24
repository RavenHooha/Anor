// 128-bit service UUID broadcast by all Anor devices.
// Random v4 UUID, fixed for the app forever.
export const ANOR_SERVICE_UUID = '7e1f8c2a-3b9d-4f6a-9c5e-8d2a1b3c4d5e';

// Manufacturer ID used when advertising. 0xFFFF is the Bluetooth SIG's reserved
// testing/development identifier — the CORRECT value for the current beta (a
// made-up real-looking ID would risk colliding with / impersonating a registered
// vendor, which is worse). Before a non-beta production launch, register a real
// Company Identifier (free SIG "Adopter" membership) and swap it in here.
export const ANOR_COMPANY_ID = 0xffff;

// Devices below this average RSSI are not considered "nearby".
// -75 dBm ≈ same room.
export const RSSI_NEARBY_THRESHOLD = -75;

// How many RSSI samples to average per device.
export const RSSI_WINDOW = 5;

// Drop devices not seen for this long (ms).
export const DEVICE_STALE_MS = 10_000;
