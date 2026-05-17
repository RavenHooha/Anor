-- Bug fix: push_tokens upsert started failing with
--   "new row violates row-level security policy (USING expression)"
-- after registerPushToken was changed to use upsert + delete-others
-- for per-user dedup. The upsert's ON CONFLICT DO UPDATE path needs an
-- UPDATE policy to satisfy RLS; previously we only had INSERT, SELECT,
-- and DELETE policies on push_tokens, so any conflict was unrecoverable.

drop policy if exists "push_tokens self-update" on push_tokens;
create policy "push_tokens self-update" on push_tokens
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
