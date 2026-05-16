-- Push notifications via pg_net → Expo Push Service.
-- Triggers fire on message + thread insert and POST to https://exp.host/--/api/v2/push/send
-- with the recipient's stored tokens. Async / fire-and-forget; failures are not surfaced.

create extension if not exists pg_net;

create table push_tokens (
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

create index push_tokens_user_id_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

create policy "push_tokens self-read" on push_tokens
  for select using (auth.uid() = user_id);
create policy "push_tokens self-insert" on push_tokens
  for insert with check (auth.uid() = user_id);
create policy "push_tokens self-delete" on push_tokens
  for delete using (auth.uid() = user_id);

-- On new message, push to the non-sender participant.
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

  select name into sender_name from profiles where id = new.from_user_id;

  for tok in select pt.token from push_tokens pt where pt.user_id = recipient_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', tok,
        'title', coalesce(sender_name, 'Ember'),
        'body', new.body,
        'sound', 'default',
        'data', jsonb_build_object('threadId', new.thread_id::text, 'kind', 'message')
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;

  return new;
end $$;

create trigger messages_notify_recipient
  after insert on messages
  for each row execute function notify_on_message_insert();

-- On new thread (wave or opener), push to the recipient.
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
        'title', coalesce(sender_name, 'Ember'),
        'body', body_text,
        'sound', 'default',
        'data', jsonb_build_object('threadId', new.id::text, 'kind', 'thread')
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;

  return new;
end $$;

create trigger threads_notify_recipient
  after insert on threads
  for each row execute function notify_on_thread_insert();
