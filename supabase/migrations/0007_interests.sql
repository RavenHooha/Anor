-- Interests: a text array on profiles. Validated by the client against
-- the fixed INTEREST_OPTIONS list. Stored as plain text so swapping the
-- list is a client-only change.

alter table profiles
  add column if not exists interests text[] not null default '{}';
