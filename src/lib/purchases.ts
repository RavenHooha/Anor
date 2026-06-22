import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// RevenueCat wiring. Keys come from env (EXPO_PUBLIC_REVENUECAT_*). If the key
// isn't set yet, every function no-ops so the app still runs — lets us ship
// the integration before the dashboard/keys are fully live.
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

let configured = false;

export function purchasesEnabled(): boolean {
  return configured;
}

// Call once at app start. Configures the SDK anonymously; identifyPurchases()
// later ties the RevenueCat customer to the Supabase user id.
export function configurePurchases(): void {
  if (configured) return;
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  if (!apiKey) return; // not set up yet — stay disabled
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });
    configured = true;
  } catch {
    // Native module unavailable (e.g. running an old build) — stay disabled.
  }
}

// Tie purchases to the signed-in user so entitlements follow the account and
// the webhook can map the RevenueCat customer back to our subscriptions row.
export async function identifyPurchases(userId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch {
    // ignore — purchases just stay anonymous
  }
}

export async function resetPurchases(): Promise<void> {
  if (!configured) return;
  try {
    // logOut() errors (and logs to console) if the user is already anonymous —
    // skip it in that case so we don't spam a harmless RevenueCat warning.
    if (await Purchases.isAnonymous()) return;
    await Purchases.logOut();
  } catch {
    // ignore
  }
}
