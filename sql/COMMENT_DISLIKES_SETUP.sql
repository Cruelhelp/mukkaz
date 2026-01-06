-- Comment dislikes setup for Mukkaz
-- Run in Supabase SQL editor (public schema).

alter table public.comments
  add column if not exists dislikes_count integer default 0;

create table if not exists public.comment_dislikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  comment_id uuid references public.comments(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (user_id, comment_id)
);

create index if not exists comment_dislikes_comment_id_idx
  on public.comment_dislikes (comment_id);

alter table public.comment_dislikes enable row level security;

drop policy if exists "Comment dislikes are viewable by everyone" on public.comment_dislikes;
drop policy if exists "Users can dislike comments" on public.comment_dislikes;
drop policy if exists "Users can remove comment dislikes" on public.comment_dislikes;

create policy "Comment dislikes are viewable by everyone"
on public.comment_dislikes for select
using (true);

create policy "Users can dislike comments"
on public.comment_dislikes for insert
with check (auth.uid() = user_id);

create policy "Users can remove comment dislikes"
on public.comment_dislikes for delete
using (auth.uid() = user_id);

create or replace function public.increment_comment_dislikes(p_comment_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.comments
  set dislikes_count = coalesce(dislikes_count, 0) + 1
  where id = p_comment_id;
end;
$$;

create or replace function public.decrement_comment_dislikes(p_comment_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.comments
  set dislikes_count = greatest(coalesce(dislikes_count, 0) - 1, 0)
  where id = p_comment_id;
end;
$$;
