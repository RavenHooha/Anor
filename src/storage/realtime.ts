import { supabase } from '../lib/supabase';
import type { Message } from './threads';

/**
 * Subscribe to new messages in a single thread.
 * Returns an unsubscribe function. Realtime must be enabled on the messages table
 * (the 0002 migration does this).
 */
export function subscribeToThreadMessages(
  threadId: string,
  onMessage: (m: Message) => void,
): () => void {
  const channel = supabase
    .channel(`thread:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const row = payload.new as {
          id: string;
          thread_id: string;
          from_user_id: string;
          body: string;
          created_at: string;
        };
        onMessage({
          id: row.id,
          threadId: row.thread_id,
          fromUserId: row.from_user_id,
          body: row.body,
          createdAt: row.created_at,
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to any change touching threads I participate in — new threads
 * arriving, thread acceptance, last_message_at bumps. Caller refetches the
 * threads list when this fires. Coarse but simple.
 */
export function subscribeToMyThreadChanges(onChange: () => void): () => void {
  // Realtime delivers only rows this user can SELECT (threads RLS = participant-
  // only), so this is already scoped to my own threads. Debounce the callback so
  // a burst of mutations — one message insert bumps message_count, last_message_at
  // and can flip accepted_at — coalesces into a single list refetch instead of
  // several.
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, 400);
  };

  const channel = supabase
    .channel('my-threads')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'threads' },
      debounced,
    )
    .subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
