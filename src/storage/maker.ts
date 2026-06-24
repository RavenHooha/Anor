import { supabase } from '../lib/supabase';

// Maker-only data layer. Every function here is gated server-side on is_maker()
// inside the RPC (migration 0045) — a non-maker calling these gets a "Not
// authorized" error from Postgres, so there is no client-side trust to leak.

export type MakerUser = {
  id: string;
  name: string;
  photoUrl: string | null;
  createdAt: string | null;
  hasThread: boolean;
};

/**
 * The maker-only user directory. Anor has no global directory for normal users
 * by design; this is the single privileged surface, and it's enforced in the
 * RPC. `search` filters by name (case-insensitive substring).
 */
export async function listUsersAsMaker(
  search: string | null = null,
  limit = 50,
  offset = 0,
): Promise<MakerUser[]> {
  const { data, error } = await supabase.rpc('maker_list_users', {
    p_search: search ?? undefined,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    photoUrl: r.photo_url,
    createdAt: r.created_at,
    hasThread: r.has_thread === true,
  }));
}

/**
 * Open (or reuse) a thread with `targetId` and post `body` directly as the
 * maker. Unlike a normal wave, the thread is pre-accepted so the message lands
 * in the recipient's inbox immediately. Returns the thread id to navigate to.
 * Respects blocks server-side. Throws on empty/oversized body or "Not authorized".
 */
export async function startMakerThread(
  targetId: string,
  body: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('start_maker_thread', {
    p_target_id: targetId,
    p_body: body,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Bad thread id from RPC');
  return data;
}
