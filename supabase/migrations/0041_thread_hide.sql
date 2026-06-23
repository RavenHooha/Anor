-- "Remove conversation" — a per-side soft hide, NOT a hard delete.
--
-- Hiding only affects the caller's own list; the other person keeps their copy,
-- and reports/moderation that reference the thread stay intact (so it can't be
-- used to erase evidence). Any new message un-hides it for both sides, so a
-- removed conversation resurfaces the moment it comes back to life. True erasure
-- stays with the 90-day inactivity job (0020) and account deletion.

alter table threads
  add column if not exists hidden_a boolean not null default false;
alter table threads
  add column if not exists hidden_b boolean not null default false;

-- On any new message, clear both hide flags so the conversation re-appears for
-- whoever had removed it (a reply, or you messaging again, brings it back).
-- Rebuilt from 0037 (security definer so the write isn't blocked by RLS).
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
    hidden_a = false,
    hidden_b = false,
    accepted_at = case
      when accepted_at is null and new.from_user_id != initiator_id then now()
      else accepted_at
    end
  where id = new.thread_id;
  return new;
end $$;

-- Hide a thread for the calling participant only.
create or replace function hide_thread(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  update threads
  set hidden_a = case when user_a = uid then true else hidden_a end,
      hidden_b = case when user_b = uid then true else hidden_b end
  where id = p_thread_id
    and (user_a = uid or user_b = uid);
end $$;

revoke execute on function hide_thread(uuid) from anon, public;
grant execute on function hide_thread(uuid) to authenticated;

-- list_my_threads: exclude threads the caller has hidden. Rebuilt from 0002
-- (still the current definition) with the hidden filter added.
create or replace function list_my_threads()
returns table (
  thread_id uuid,
  other_id uuid,
  other_name text,
  other_photo_url text,
  initiator_id uuid,
  opener_text text,
  accepted_at timestamptz,
  last_message_at timestamptz,
  message_count int,
  last_message_body text,
  last_message_from uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    t.id as thread_id,
    case when t.user_a = auth.uid() then t.user_b else t.user_a end as other_id,
    p.name as other_name,
    p.photo_url as other_photo_url,
    t.initiator_id,
    t.opener_text,
    t.accepted_at,
    t.last_message_at,
    t.message_count,
    lm.body as last_message_body,
    lm.from_user_id as last_message_from
  from threads t
  join profiles p on p.id = case when t.user_a = auth.uid() then t.user_b else t.user_a end
  left join lateral (
    select body, from_user_id
    from messages
    where thread_id = t.id
    order by created_at desc
    limit 1
  ) lm on true
  where (t.user_a = auth.uid() or t.user_b = auth.uid())
    and not (case when t.user_a = auth.uid() then t.hidden_a else t.hidden_b end)
  order by t.last_message_at desc;
$$;

revoke execute on function list_my_threads() from anon, public;
grant execute on function list_my_threads() to authenticated;
