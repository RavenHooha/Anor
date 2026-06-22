import {
  GoogleSignin,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';

// The OAuth 2.0 **Web** client ID from Google Cloud (not the Android client).
// It's the audience Supabase validates the Google ID token against, so the
// native lib must request the token with this as its serverClientId.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Hide the button entirely if the build wasn't given a client ID.
export const GOOGLE_AUTH_AVAILABLE = !!WEB_CLIENT_ID;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!WEB_CLIENT_ID) {
    throw new Error('Google sign-in is not configured.');
  }
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

/**
 * Native Google sign-in → Supabase session.
 * Returns true on success, false if the user backed out of the picker.
 * Throws on real failures so the screen can surface a message.
 */
export async function signInWithGoogle(): Promise<boolean> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  // v13+: cancellation / no-credential come back as a non-success response,
  // not a thrown error — treat those as a quiet no-op.
  if (!isSuccessResponse(response)) return false;

  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return an ID token.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return true;
}
