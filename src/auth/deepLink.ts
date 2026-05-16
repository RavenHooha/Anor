import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

const REDIRECT_URL = Linking.createURL('auth-callback');

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: REDIRECT_URL },
  });
  if (error) throw error;
}

async function handleAuthUrl(url: string | null): Promise<void> {
  if (!url) return;
  // PKCE flow: URL contains a `code` query param to exchange for a session.
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code !== 'string') return;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn('exchangeCodeForSession failed', error.message);
  }
}

export function startAuthLinkListener(): () => void {
  Linking.getInitialURL().then(handleAuthUrl);
  const sub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));
  return () => sub.remove();
}

export const AUTH_REDIRECT_URL = REDIRECT_URL;
