-- Bans + Reports setup for Mukkaz
-- Run in Supabase SQL editor (public schema).

create extension if not exists "pgcrypto";

-- 1) User ban fields
alter table public.profiles
  add column if not exists is_banned boolean default false,
  add column if not exists ban_reason text,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid references public.profiles(id);

-- 2) IP bans table
create table if not exists public.ip_bans (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  reason text,
  active boolean not null default true,
  banned_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  expires_at timestamptz
);

create unique index if not exists ip_bans_ip_active_idx
  on public.ip_bans (ip)
  where active = true;

alter table public.ip_bans enable row level security;

create policy "Admins can manage ip bans"
on public.ip_bans
for all
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Secure IP ban check (for client-side enforcement)
create or replace function public.check_ip_ban(ip_address text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1
    from public.ip_bans b
    where b.ip = ip_address
      and b.active = true
      and (b.expires_at is null or b.expires_at > now())
  );
end;
$$;

grant execute on function public.check_ip_ban(text) to anon, authenticated;

-- 3) Video reports
alter table public.videos
  add column if not exists reported_count int default 0,
  add column if not exists last_reported_at timestamptz;

create table if not exists public.video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz default now()
);

create unique index if not exists video_reports_unique_reporter_idx
  on public.video_reports (video_id, reporter_id);

create index if not exists video_reports_video_id_idx
  on public.video_reports (video_id);

create index if not exists video_reports_reported_user_id_idx
  on public.video_reports (reported_user_id);

alter table public.video_reports enable row level security;

create policy "Users can report videos"
on public.video_reports
for insert
with check (reporter_id = auth.uid());

create policy "Admins can read reports"
on public.video_reports
for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Video owners can read their reports"
on public.video_reports
for select
using (
  exists (
    select 1 from public.videos v
    where v.id = video_reports.video_id and v.user_id = auth.uid()
  )
);

-- Keep reported_count in sync
create or replace function public.populate_reported_user()
returns trigger
language plpgsql
as $$
begin
  if new.reported_user_id is null then
    select v.user_id into new.reported_user_id
    from public.videos v
    where v.id = new.video_id;
  end if;
  return new;
end;
$$;

create or replace function public.bump_report_count()
returns trigger
language plpgsql
as $$
begin
  update public.videos
  set reported_count = coalesce(reported_count, 0) + 1,
      last_reported_at = now()
  where id = new.video_id;
  return new;
end;
$$;

create or replace function public.drop_report_count()
returns trigger
language plpgsql
as $$
begin
  update public.videos
  set reported_count = greatest(coalesce(reported_count, 0) - 1, 0)
  where id = old.video_id;
  return old;
end;
$$;

drop trigger if exists video_reports_insert_bump on public.video_reports;
drop trigger if exists video_reports_set_user on public.video_reports;
create trigger video_reports_set_user
before insert on public.video_reports
for each row execute function public.populate_reported_user();

create trigger video_reports_insert_bump
after insert on public.video_reports
for each row execute function public.bump_report_count();

drop trigger if exists video_reports_delete_drop on public.video_reports;
create trigger video_reports_delete_drop
after delete on public.video_reports
for each row execute function public.drop_report_count();
