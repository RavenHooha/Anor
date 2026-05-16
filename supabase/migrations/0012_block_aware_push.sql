-- Don't fire push notifications between users who have blocked each other,
-- and update the fallback title from "Ember" to "Nigh".

create or replace function notify_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  recipient_id uuid;
  sender_name text;
  tok text;
begin
  select case when t.user_a = new.from_user_id then t.user_b else t.user_a end
  into recipient_id
  from threads t where t.id = new.thread_id;

  if recipient_id is null then return new; end if;
  if is_blocked(new.from_user_id, recipient_id) then return new; end if;

  select name into sender_name from profiles where id = new.from_user_id;

  for tok in select pt.token from push_tokens pt where pt.user_id = recipient_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', tok,
        'title', coalesce(sender_name, 'Nigh'),
        'body', new.body,
        'sound', 'default',
        'data', jsonb_build_object('threadId', new.thread_id::text, 'kind', 'message')
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;

  return new;
end $$;

create or replace function notify_on_thread_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  recipient_id uuid;
  sender_name text;
  tok text;
  body_text text;
begin
  recipient_id := case when new.user_a = new.initiator_id then new.user_b else new.user_a end;

  if is_blocked(new.initiator_id, recipient_id) then return new; end if;

  select name into sender_name from profiles where id = new.initiator_id;

  body_text := case
    when new.opener_text is null then 'waved at you'
    else new.opener_text
  end;

  for tok in select pt.token from push_tokens pt where pt.user_id = recipient_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', tok,
        'title', coalesce(sender_name, 'Nigh'),
        'body', body_text,
        'sound', 'default',
        'data', jsonb_build_object('threadId', new.id::text, 'kind', 'thread')
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;

  return new;
end $$;
