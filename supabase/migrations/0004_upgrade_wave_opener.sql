-- Fix: tapping Message after Wave silently dropped the opener text because
-- create_or_get_thread returned the existing thread without updating opener_text.
-- Now, when the existing thread is still pending and you're the initiator,
-- the new opener gets written in (effectively upgrading the wave to an opener).

create or replace function create_or_get_thread(other_id uuid, opener text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  existing_id uuid;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_id = me then
    raise exception 'Cannot create thread with yourself';
  end if;

  a := least(me, other_id);
  b := greatest(me, other_id);

  select id into existing_id from threads where user_a = a and user_b = b;
  if existing_id is not null then
    if opener is not null then
      update threads
      set opener_text = opener
      where id = existing_id
        and initiator_id = me
        and accepted_at is null
        and opener_text is null;
    end if;
    return existing_id;
  end if;

  insert into threads (user_a, user_b, initiator_id, opener_text)
  values (a, b, me, opener)
  returning id into new_id;

  return new_id;
end $$;
