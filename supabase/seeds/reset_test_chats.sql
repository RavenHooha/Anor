-- Reset all chat state with the seeded test users (Maya, Theo, Naomi, Daria, Felix).
-- Deletes threads + messages between you and them. Does NOT delete the test users themselves
-- or your own profile/messages with non-test users.

with test_ids as (
  select id from auth.users
  where email in (
    'maya-test@ember.dev',
    'theo-test@ember.dev',
    'naomi-test@ember.dev',
    'daria-test@ember.dev',
    'felix-test@ember.dev'
  )
)
delete from threads
where user_a in (select id from test_ids)
   or user_b in (select id from test_ids);
-- messages, waves, etc. cascade automatically via foreign-key on delete cascade
