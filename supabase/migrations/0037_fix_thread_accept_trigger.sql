-- BUG FIX: thread acceptance / message_count never updated.
--
-- on_message_insert() updates the `threads` row on every message: it bumps
-- message_count + last_message_at, and sets accepted_at the first time the
-- non-initiator (recipient) replies. But the function was created
-- SECURITY INVOKER, and `threads` has RLS enabled with NO update policy
-- (intentionally — "only the trigger updates threads"). So the trigger ran
-- as the message sender, and RLS silently filtered its UPDATE to zero rows.
--
-- Result: recipients could reply, but the thread never flipped to accepted —
-- the initiator stayed locked on "Waiting for … to respond" forever, and
-- message_count / last_message_at never moved. Broken for every thread.
--
-- Fix: run the function as SECURITY DEFINER so its write to `threads` is not
-- subject to the sender's RLS (matching how every other privileged trigger /
-- RPC in this schema is written). search_path stays pinned.

create or replace function on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update threads
  set
    message_count = message_count + 1,
    last_message_at = now(),
    accepted_at = case
      when accepted_at is null and new.from_user_id != initiator_id then now()
      else accepted_at
    end
  where id = new.thread_id;
  return new;
end $$;
-- The existing `messages_update_thread` trigger already calls this function;
-- create-or-replace keeps it attached, so no trigger change is needed.

-- ── One-time repair of threads broken while the trigger was a no-op ──────

-- Backfill acceptance: any thread that has a message from the non-initiator
-- should have been accepted at that first reply.
update threads t
set accepted_at = sub.first_reply_at
from (
  select m.thread_id, min(m.created_at) as first_reply_at
  from messages m
  join threads th on th.id = m.thread_id
  where m.from_user_id <> th.initiator_id
  group by m.thread_id
) sub
where t.id = sub.thread_id
  and t.accepted_at is null;

-- Recompute message_count and last_message_at from the actual message rows,
-- since they were never incremented.
update threads t
set
  message_count = c.cnt,
  last_message_at = coalesce(c.last_at, t.last_message_at)
from (
  select thread_id, count(*)::int as cnt, max(created_at) as last_at
  from messages
  group by thread_id
) c
where t.id = c.thread_id
  and t.message_count is distinct from c.cnt;
