import { supabase } from '../lib/supabase';
import {
  NO_SUPPORTER,
  type SupporterInfo,
  type SubscriptionTier,
} from '../types/subscription';

export type Profile = {
  id: string;
  name: string;
  photoUrl: string | null;
  photos: string[];
  bio: string;
  interests: string[];
  connectPrefs: string[];
  age: number | null;
  hideMessagePreview: boolean;
  analyticsOptedIn: boolean;
  createdAt: string | null;
};

export const MAX_PHOTOS = 4;

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, photo_url, photos, bio, interests, connect_prefs, age, hide_message_preview, analytics_opted_in, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    photoUrl: data.photo_url,
    photos: Array.isArray(data.photos) ? data.photos : [],
    bio: data.bio ?? '',
    interests: Array.isArray(data.interests) ? data.interests : [],
    connectPrefs: Array.isArray(data.connect_prefs) ? data.connect_prefs : [],
    age: typeof data.age === 'number' ? data.age : null,
    hideMessagePreview: data.hide_message_preview === true,
    analyticsOptedIn: data.analytics_opted_in === true,
    createdAt: data.created_at ?? null,
  };
}

// The current user's own supporter state — active tier + cosmetic choices.
// Reads the subscriptions row (RLS allows self-read) and the cosmetic columns
// on the own profile. Returns NO_SUPPORTER when there's no active sub.
export async function getMySupporter(): Promise<SupporterInfo> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return NO_SUPPORTER;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, is_founding, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  const active =
    !!sub &&
    sub.status === 'active' &&
    new Date(sub.current_period_end).getTime() > Date.now();
  if (!active || !sub) return NO_SUPPORTER;

  const { data: prof } = await supabase
    .from('profiles')
    .select('accent_color, profile_theme, profile_background')
    .eq('id', userId)
    .maybeSingle();

  return {
    tier: sub.tier as SubscriptionTier,
    isFounding: sub.is_founding === true,
    accentColor: prof?.accent_color ?? null,
    profileTheme: prof?.profile_theme ?? null,
    profileBackground: prof?.profile_background ?? null,
  };
}

// Save the user's cosmetic choices (supporter perk). Only the columns passed
// are updated. The columns only *render* when the user has an active sub
// (gated server-side in the read RPCs), so setting them while unsubscribed is
// harmless — they light up if/when a sub is active.
export async function setProfileCosmetics(input: {
  accentColor?: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');
  const row: Record<string, unknown> = {};
  if (input.accentColor !== undefined) row.accent_color = input.accentColor;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}

export async function setHideMessagePreview(value: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('profiles')
    .update({ hide_message_preview: value })
    .eq('id', userId);
  if (error) throw error;
}

export async function setAnalyticsOptedIn(value: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('profiles')
    .update({ analytics_opted_in: value })
    .eq('id', userId);
  if (error) throw error;
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}

export async function exportMyData(): Promise<unknown> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return data;
}

export async function uploadProfilePhoto(localUri: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  // Unique-per-upload filename so old photos aren't overwritten — the
  // gallery decides which URLs are "current."
  const path = `${userId}/${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('profile-photos')
    .upload(path, arrayBuffer, { contentType, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function upsertMyProfile(input: {
  name: string;
  photoUrl?: string | null;
  photos?: string[];
  bio: string;
  interests?: string[];
  connectPrefs?: string[];
  age?: number | null;
}): Promise<Profile> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const row: Record<string, unknown> = {
    id: userId,
    name: input.name,
    bio: input.bio,
  };
  if (input.interests !== undefined) row.interests = input.interests;
  if (input.connectPrefs !== undefined) row.connect_prefs = input.connectPrefs;
  if (input.age !== undefined) row.age = input.age;
  if (input.photos !== undefined) {
    row.photos = input.photos;
    row.photo_url = input.photos[0] ?? null;
  } else if (input.photoUrl !== undefined) {
    row.photo_url = input.photoUrl;
    if (input.photoUrl) {
      row.photos = [input.photoUrl];
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('id, name, photo_url, photos, bio, interests, connect_prefs, age, hide_message_preview, analytics_opted_in, created_at')
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    photoUrl: data.photo_url,
    photos: Array.isArray(data.photos) ? data.photos : [],
    bio: data.bio ?? '',
    interests: Array.isArray(data.interests) ? data.interests : [],
    connectPrefs: Array.isArray(data.connect_prefs) ? data.connect_prefs : [],
    age: typeof data.age === 'number' ? data.age : null,
    hideMessagePreview: data.hide_message_preview === true,
    analyticsOptedIn: data.analytics_opted_in === true,
    createdAt: data.created_at ?? null,
  };
}
