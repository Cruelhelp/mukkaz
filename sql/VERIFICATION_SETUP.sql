-- Verification + User Metrics setup for Mukkaz
-- Run in Supabase SQL editor (public schema).

alter table public.profiles
  add column if not exists is_verified boolean default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_reason text,
  add column if not exists videos_watched int default 0,
  add column if not exists comments_made int default 0,
  add column if not exists votes_made int default 0;

-- Check verification status for a user
create or replace function public.check_verification(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  payout_verified boolean;
  watched_count int;
  comment_count int;
  vote_count int;
begin
  if p_user_id is null then
    return;
  end if;

  select exists (
    select 1
    from public.payout_requests pr
    where pr.user_id = p_user_id and pr.status = 'approved'
  ) into payout_verified;

  select videos_watched, comments_made, votes_made
  into watched_count, comment_count, vote_count
  from public.profiles
  where id = p_user_id;

  if payout_verified or
     (coalesce(watched_count, 0) >= 20 and coalesce(comment_count, 0) >= 5 and coalesce(vote_count, 0) >= 10) then
    update public.profiles
    set is_verified = true,
        verified_at = coalesce(verified_at, now()),
        verified_reason = case
          when payout_verified then 'payout'
          else 'activity'
        end
    where id = p_user_id;
  end if;
end;
$$;

-- Increment watch metric
create or replace function public.bump_videos_watched()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  update public.profiles
  set videos_watched = coalesce(videos_watched, 0) + 1
  where id = new.user_id;

  perform public.check_verification(new.user_id);
  return new;
end;
$$;

drop trigger if exists watch_history_bump_watched on public.watch_history;
create trigger watch_history_bump_watched
after insert on public.watch_history
for each row execute function public.bump_videos_watched();

-- Increment comment metric
create or replace function public.bump_comments_made()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  update public.profiles
  set comments_made = coalesce(comments_made, 0) + 1
  where id = new.user_id;

  perform public.check_verification(new.user_id);
  return new;
end;
$$;

drop trigger if exists comments_bump_made on public.comments;
create trigger comments_bump_made
after insert on public.comments
for each row execute function public.bump_comments_made();

-- Increment votes metric (likes + dislikes)
create or replace function public.bump_votes_made()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  update public.profiles
  set votes_made = coalesce(votes_made, 0) + 1
  where id = new.user_id;

  perform public.check_verification(new.user_id);
  return new;
end;
$$;

drop trigger if exists video_votes_bump_made on public.video_votes;
create trigger video_votes_bump_made
after insert on public.video_votes
for each row execute function public.bump_votes_made();

-- Verify on first approved payout
create or replace function public.verify_on_payout()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and (old.status is distinct from new.status) then
    update public.profiles
    set is_verified = true,
        verified_at = coalesce(verified_at, now()),
        verified_reason = 'payout'
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists payout_verify_user on public.payout_requests;
create trigger payout_verify_user
after update on public.payout_requests
for each row execute function public.verify_on_payout();

-- Optional backfill for existing accounts
update public.profiles p
set videos_watched = coalesce((
  select count(*) from public.watch_history wh where wh.user_id = p.id
), 0),
comments_made = coalesce((
  select count(*) from public.comments c where c.user_id = p.id
), 0),
votes_made = coalesce((
  select count(*) from public.video_votes vv where vv.user_id = p.id
), 0);

update public.profiles p
set is_verified = true,
    verified_at = coalesce(verified_at, now()),
    verified_reason = 'payout'
where exists (
  select 1 from public.payout_requests pr
  where pr.user_id = p.id and pr.status = 'approved'
);

update public.profiles p
set is_verified = true,
    verified_at = coalesce(verified_at, now()),
    verified_reason = 'activity'
where is_verified = false
  and coalesce(videos_watched, 0) >= 20
  and coalesce(comments_made, 0) >= 5
  and coalesce(votes_made, 0) >= 10;
