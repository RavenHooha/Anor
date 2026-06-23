import { supabase } from '../lib/supabase';
import { requireUserId } from '../lib/session';

export type BlockedUser = {
  userId: string;
  name: string;
  photoUrl: string | null;
  blockedAt: string;
};

export async function listMyBlocks(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('list_my_blocks');
  if (error) throw error;
  if (!data) return [];
  return (data as Array<{
    user_id: string;
    name: string;
    photo_url: string | null;
    blocked_at: string;
  }>).map((r) => ({
    userId: r.user_id,
    name: r.name,
    photoUrl: r.photo_url,
    blockedAt: r.blocked_at,
  }));
}

export async function blockUser(otherId: string): Promise<void> {
  const me = await requireUserId();
  if (me === otherId) throw new Error('Cannot block yourself');

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: me, blocked_id: otherId });
  // 23505 = unique violation: already blocked. Treat as no-op.
  if (error && (error as { code?: string }).code !== '23505') throw error;
}

export async function unblockUser(otherId: string): Promise<void> {
  const me = await requireUserId();

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', otherId);
  if (error) throw error;
}
