-- Watch history saved flag
-- Run in Supabase SQL editor (public schema).

alter table public.watch_history
  add column if not exists saved boolean default false;
