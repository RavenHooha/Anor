import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_RADIUS_M, RADIUS_PRESETS } from '../data/nearby';

const KEY = 'anor.radius';
const VALID = new Set(RADIUS_PRESETS.map((p) => p.meters));

export async function loadRadius(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && VALID.has(n) ? n : DEFAULT_RADIUS_M;
}

export async function saveRadius(meters: number): Promise<void> {
  await AsyncStorage.setItem(KEY, String(meters));
}
