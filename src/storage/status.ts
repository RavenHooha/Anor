import { supabase } from '../lib/supabase';
import type { Status } from '../types/status';

const VALID: readonly Status[] = ['open', 'connect', 'focus', 'spark'];

// Statuses older than this are treated as stale on load — the app shows
// "Pick a vibe" again and the DB row's status is cleared.
const STATUS_STALE_HOURS = 8;

export async function loadStatus(): Promise<Status | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('presence')
    .select('status, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.status) return null;
  if (!(VALID as readonly string[]).includes(data.status)) return null;

  if (typeof data.updated_at === 'string') {
    const ageMs = Date.now() - new Date(data.updated_at).getTime();
    if (ageMs > STATUS_STALE_HOURS * 60 * 60 * 1000) {
      // Clear stale row so the DB matches what the user sees.
      clearStatus().catch(() => {});
      return null;
    }
  }

  return data.status as Status;
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

export async function clearStatus(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  await supabase
    .from('presence')
    .update({ status: null })
    .eq('user_id', userId);
}
