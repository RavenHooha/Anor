import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from '../storage/pushTokens';

/**
 * Foreground notification behavior — surface a banner + sound when the app
 * is open. Without this, foreground pushes are silent.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registered = false;

export async function setupPushNotifications(): Promise<void> {
  if (registered) return;

  // iOS Simulator can't receive push (no APNS). Android emulators with
  // Play Services can — don't bail on Android.
  if (Platform.OS === 'ios' && !Device.isDevice) {
    console.warn('[push] Skipping — iOS Simulator can\'t receive push');
    return;
  }

  // Android needs a notification channel before posting any.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let granted = existing === 'granted';
  if (!granted) {
    const { status } = await Notifications.requestPermissionsAsync();
    granted = status === 'granted';
  }
  if (!granted) {
    console.warn('[push] Permission denied');
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  if (!projectId) {
    console.warn(
      '[push] No EAS projectId found. Run `eas init` in the project to enable push tokens.',
    );
    return;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(tokenData.data);
    registered = true;
  } catch (e) {
    console.warn('[push] Failed to register token', e);
  }
}

/**
 * Subscribe to taps on incoming notifications. The handler receives the
 * notification's `data` payload (we put `threadId` in there).
 */
export function onNotificationTap(
  handler: (data: Record<string, unknown>) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data) handler(data as Record<string, unknown>);
  });
  return () => sub.remove();
}
