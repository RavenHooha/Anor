import { supabase } from '../lib/supabase';
import type { Status } from '../types/status';

const VALID: readonly Status[] = ['open', 'connect', 'focus', 'spark'];

export async function loadStatus(): Promise<Status | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('presence')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.status) return null;
  if ((VALID as readonly string[]).includes(data.status)) {
    return data.status as Status;
  }
  return null;
}

export async function saveStatus(status: Status): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('presence')
    .upsert({ user_id: userId, status }, { onConflict: 'user_id' });
  if (error) throw error;
}
