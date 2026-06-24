import { supabase } from '../lib/supabase';
import { currentUserId } from '../lib/session';

export const VENUE_MAX_LENGTH = 60;

export async function setVenue(venue: string): Promise<void> {
  const trimmed = venue.trim();
  if (trimmed.length === 0 || trimmed.length > VENUE_MAX_LENGTH) return;
  const { error } = await supabase.rpc('set_venue', { venue_text: trimmed });
  if (error) throw error;
}

export async function clearVenue(): Promise<void> {
  const { error } = await supabase.rpc('clear_venue');
  if (error) throw error;
}

/**
 * Unified "go quiet here": drops the auto co-presence and the manual label, and
 * suppresses auto re-check-in at the current venue until the user leaves it.
 */
export async function checkoutVenue(): Promise<void> {
  const { error } = await supabase.rpc('checkout_venue');
  if (error) throw error;
}

export async function getMyVenue(): Promise<string | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('presence')
    .select('venue')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) return null;
  return data?.venue ?? null;
}
