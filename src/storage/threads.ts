import { supabase } from '../lib/supabase';
import { currentUserId, requireUserId } from '../lib/session';

export const MESSAGE_CAP = 100;
export const MESSAGE_LIMIT = 500;

export type ThreadSummary = {
  threadId: string;
  otherId: string;
  otherName: string;
  otherPhotoUrl: string | null;
  initiatorId: string;
  openerText: string | null;
  acceptedAt: string | null;
  lastMessageAt: string;
  messageCount: number;
  lastMessageBody: string | null;
  lastMessageFrom: string | null;
  unread: boolean;
};

export type Message = {
  id: string;
  threadId: string;
  fromUserId: string;
  body: string;
  createdAt: string;
};

export type ThreadDetail = {
  id: string;
  userA: string;
  userB: string;
  initiatorId: string;
  openerText: string | null;
  acceptedAt: string | null;
  messageCount: number;
  otherId: string;
  otherName: string;
  otherPhotoUrl: string | null;
  otherIsMaker: boolean;
};

export async function createOrGetThread(
  otherUserId: string,
  opener: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_or_get_thread', {
    other_id: otherUserId,
    // The RPC accepts a null opener (a pure wave); generated types don't model
    // nullable text args, so cast to satisfy the signature.
    opener: opener as string,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Bad thread id from RPC');
  return data;
}

/**
 * Look up an existing thread with another user without creating one.
 * Returns null if no thread exists yet.
 */
export async function findExistingThread(otherUserId: string): Promise<string | null> {
  const me = await currentUserId();
  if (!me) return null;
  const a = me < otherUserId ? me : otherUserId;
  const b = me < otherUserId ? otherUserId : me;
  const { data, error } = await supabase
    .from('threads')
    .select('id')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

/**
 * Remove a thread from MY list only (per-side soft hide). The other person
 * keeps their copy; any new message un-hides it again. Not a hard delete.
 */
export async function hideThread(threadId: string): Promise<void> {
  const { error } = await supabase.rpc('hide_thread', { p_thread_id: threadId });
  if (error) throw error;
}

export async function listMyThreads(): Promise<ThreadSummary[]> {
  const { data, error } = await supabase.rpc('list_my_threads');
  if (error) throw error;
  if (!data) return [];
  return data.map((r) => ({
    threadId: r.thread_id,
    otherId: r.other_id,
    otherName: r.other_name,
    otherPhotoUrl: r.other_photo_url,
    initiatorId: r.initiator_id,
    openerText: r.opener_text,
    acceptedAt: r.accepted_at,
    lastMessageAt: r.last_message_at,
    messageCount: r.message_count,
    lastMessageBody: r.last_message_body,
    lastMessageFrom: r.last_message_from,
    unread: r.unread === true,
  }));
}

/** Mark a thread read up to now (clears its unread state for me). */
export async function markThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_thread_read', {
    p_thread_id: threadId,
  });
  if (error) throw error;
}

export async function getThread(threadId: string): Promise<ThreadDetail | null> {
  const me = await currentUserId();
  if (!me) return null;

  const { data, error } = await supabase
    .from('threads')
    .select(
      'id, user_a, user_b, initiator_id, opener_text, accepted_at, message_count',
    )
    .eq('id', threadId)
    .maybeSingle();
  if (error || !data) return null;

  const otherId = data.user_a === me ? data.user_b : data.user_a;
  // profiles SELECT is owner-only (migration 0032); read another user's safe
  // public columns through the security-definer RPC instead of the table.
  const { data: publicRows } = await supabase.rpc('get_public_profile', {
    target_id: otherId,
  });
  const profile = Array.isArray(publicRows) ? publicRows[0] : null;

  return {
    id: data.id,
    userA: data.user_a,
    userB: data.user_b,
    initiatorId: data.initiator_id,
    openerText: data.opener_text,
    acceptedAt: data.accepted_at,
    messageCount: data.message_count,
    otherId,
    otherName: profile?.name ?? 'Unknown',
    otherPhotoUrl: profile?.photo_url ?? null,
    otherIsMaker: profile?.is_maker === true,
  };
}

export async function listMessages(threadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, from_user_id, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(MESSAGE_CAP);
  if (error) throw error;
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    fromUserId: r.from_user_id,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function sendMessage(threadId: string, body: string): Promise<Message> {
  const me = await requireUserId();

  const trimmed = body.trim();
  if (trimmed.length === 0) throw new Error('Message is empty');
  if (trimmed.length > MESSAGE_LIMIT) {
    throw new Error(`Message exceeds ${MESSAGE_LIMIT} characters`);
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, from_user_id: me, body: trimmed })
    .select('id, thread_id, from_user_id, body, created_at')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    threadId: data.thread_id,
    fromUserId: data.from_user_id,
    body: data.body,
    createdAt: data.created_at,
  };
}

