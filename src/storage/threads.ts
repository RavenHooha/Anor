import { supabase } from '../lib/supabase';

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
};

export async function createOrGetThread(
  otherUserId: string,
  opener: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_or_get_thread', {
    other_id: otherUserId,
    opener,
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
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
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

export async function listMyThreads(): Promise<ThreadSummary[]> {
  const { data, error } = await supabase.rpc('list_my_threads');
  if (error) throw error;
  if (!data) return [];
  return (data as RpcRow[]).map((r) => ({
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
  }));
}

export async function getThread(threadId: string): Promise<ThreadDetail | null> {
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, photo_url')
    .eq('id', otherId)
    .maybeSingle();

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
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) throw new Error('Not authenticated');

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

type RpcRow = {
  thread_id: string;
  other_id: string;
  other_name: string;
  other_photo_url: string | null;
  initiator_id: string;
  opener_text: string | null;
  accepted_at: string | null;
  last_message_at: string;
  message_count: number;
  last_message_body: string | null;
  last_message_from: string | null;
};
