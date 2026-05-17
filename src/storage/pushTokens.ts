import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export async function registerPushToken(token: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) return;

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: me, token, platform: Platform.OS },
      { onConflict: 'user_id,token' },
    );
  if (error) throw error;

  // Last-write-wins per user: drop any prior tokens for this user other
  // than the one we just registered. Avoids accumulating orphan tokens
  // from reinstalls (each reinstall mints a fresh Expo push token).
  await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', me)
    .neq('token', token);
}

export async function unregisterPushToken(token: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) return;

  await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', me)
    .eq('token', token);
}
