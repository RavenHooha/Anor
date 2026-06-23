import { supabase } from './supabase';

// Cheap auth-id accessors backed by getSession() (reads the persisted session
// locally — no network), instead of getUser() (a JWT validation round-trip).
// Use these for the common "I just need my own id for an already-RLS-protected
// query" case; reserve getUser()'s server validation for genuine trust
// boundaries.

/** Current user id from the cached session, or null if signed out. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Current user id, throwing when signed out — for write paths that require auth. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error('Not authenticated');
  return id;
}
