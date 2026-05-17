import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  name: string;
  photoUrl: string | null;
  photos: string[];
  bio: string;
  interests: string[];
  age: number | null;
  hideMessagePreview: boolean;
  analyticsOptedIn: boolean;
};

export const MAX_PHOTOS = 4;

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, photo_url, photos, bio, interests, age, hide_message_preview, analytics_opted_in')
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
    age: typeof data.age === 'number' ? data.age : null,
    hideMessagePreview: data.hide_message_preview === true,
    analyticsOptedIn: data.analytics_opted_in === true,
  };
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
    .select('id, name, photo_url, photos, bio, interests, age, hide_message_preview, analytics_opted_in')
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    photoUrl: data.photo_url,
    photos: Array.isArray(data.photos) ? data.photos : [],
    bio: data.bio ?? '',
    interests: Array.isArray(data.interests) ? data.interests : [],
    age: typeof data.age === 'number' ? data.age : null,
    hideMessagePreview: data.hide_message_preview === true,
    analyticsOptedIn: data.analytics_opted_in === true,
  };
}
