-- Earnings + Payouts setup for Mukkaz
-- Run in Supabase SQL editor (public schema).

create extension if not exists "pgcrypto";

-- 1) Track eligible views (unique per viewer per 24h)
create table if not exists public.video_views (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  viewer_token text,
  counted boolean default true,
  viewed_at timestamptz default now()
);

create index if not exists video_views_video_id_idx on public.video_views(video_id);
create index if not exists video_views_viewer_id_idx on public.video_views(viewer_id);
create index if not exists video_views_viewer_token_idx on public.video_views(viewer_token);

alter table public.video_views enable row level security;

-- Allow owners and admins to read view rows for earnings.
create policy "Video owners can read their view logs"
on public.video_views
for select
using (
  exists (
    select 1
    from public.videos v
    where v.id = video_views.video_id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Allow inserts from logged-in viewers or anonymous tokens.
create policy "Allow view inserts"
on public.video_views
for insert
with check (
  (auth.uid() is not null and viewer_id = auth.uid())
  or (auth.uid() is null and viewer_token is not null)
);

-- 2) Payout requests
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_jmd numeric(12,2) not null,
  method text not null check (method in ('lynk','crypto','bank')),
  details text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_views int not null default 0,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  admin_notes text
);

create index if not exists payout_requests_user_id_idx on public.payout_requests(user_id);

alter table public.payout_requests enable row level security;

create policy "Users can manage own payout requests"
on public.payout_requests
for select
using (user_id = auth.uid());

create policy "Users can insert payout requests"
on public.payout_requests
for insert
with check (user_id = auth.uid());

create policy "Admins can manage payout requests"
on public.payout_requests
for all
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 3) Earnings views
create or replace view public.video_earnings as
select
  v.id as video_id,
  v.user_id,
  count(vw.*) filter (where vw.counted = true)::int as eligible_views,
  floor(count(vw.*) filter (where vw.counted = true) / 2)::int as earnings_jmd
from public.videos v
left join public.video_views vw on vw.video_id = v.id
group by v.id;

create or replace view public.creator_earnings_summary as
select
  v.user_id,
  count(vw.*) filter (where vw.counted = true)::int as eligible_views,
  floor(count(vw.*) filter (where vw.counted = true) / 2)::int as earnings_jmd,
  coalesce((
    select sum(pr.amount_jmd)
    from public.payout_requests pr
    where pr.user_id = v.user_id and pr.status = 'approved'
  ), 0)::numeric(12,2) as paid_jmd
from public.videos v
left join public.video_views vw on vw.video_id = v.id
group by v.user_id;

-- 4) Notify admins helper (optional)
create or replace function public.notify_admins(
  title text,
  message text,
  link text default null
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.notifications (user_id, type, title, message, link, actor_id)
  select p.id, 'payout_request', title, message, link, auth.uid()
  from public.profiles p
  where p.role = 'admin';
end;
$$;

-- 5) Record view RPC (anti-cheat basics)
create or replace function public.record_view(
  video_id uuid,
  viewer_token text
) returns jsonb
language plpgsql
security definer
as $$
declare
  owner_id uuid;
  existing_count int;
  counted boolean := false;
begin
  select user_id into owner_id from public.videos where id = record_view.video_id;
  if owner_id is null then
    return jsonb_build_object('counted', false, 'reason', 'missing_video');
  end if;

  if auth.uid() is not null and auth.uid() = owner_id then
    return jsonb_build_object('counted', false, 'reason', 'owner_view');
  end if;

  if auth.uid() is not null then
    select count(*) into existing_count
    from public.video_views
    where video_id = record_view.video_id
      and viewer_id = auth.uid()
      and viewed_at > now() - interval '24 hours';
  else
    select count(*) into existing_count
    from public.video_views
    where video_id = record_view.video_id
      and viewer_token = record_view.viewer_token
      and viewed_at > now() - interval '24 hours';
  end if;

  if existing_count = 0 then
    insert into public.video_views (video_id, viewer_id, viewer_token, counted)
    values (record_view.video_id, auth.uid(), record_view.viewer_token, true);

    update public.videos
    set views_count = coalesce(views_count, 0) + 1
    where id = record_view.video_id;

    counted := true;
  end if;

  return jsonb_build_object('counted', counted);
end;
$$;

-- 6) Request payout RPC
create or replace function public.request_payout(
  payout_method text,
  payout_details text
) returns public.payout_requests
language plpgsql
security definer
as $$
declare
  eligible_views int;
  earnings_jmd int;
  paid_jmd numeric(12,2);
  pending_jmd numeric(12,2);
  available_jmd numeric(12,2);
  payout_row public.payout_requests;
begin
  select
    count(vw.*) filter (where vw.counted = true)::int
  into eligible_views
  from public.videos v
  left join public.video_views vw on vw.video_id = v.id
  where v.user_id = auth.uid();

  earnings_jmd := floor(coalesce(eligible_views, 0) / 2);

  select coalesce(sum(amount_jmd), 0)
  into paid_jmd
  from public.payout_requests
  where user_id = auth.uid() and status = 'approved';

  select coalesce(sum(amount_jmd), 0)
  into pending_jmd
  from public.payout_requests
  where user_id = auth.uid() and status = 'pending';

  available_jmd := earnings_jmd - paid_jmd - pending_jmd;

  if earnings_jmd < 1000 then
    raise exception 'Need JMD 1000 earned to request payout';
  end if;

  if available_jmd < 1000 then
    raise exception 'Need at least JMD 1000 available to request payout';
  end if;

  insert into public.payout_requests (user_id, amount_jmd, method, details, requested_views)
  values (auth.uid(), available_jmd, payout_method, payout_details, eligible_views)
  returning * into payout_row;

  perform public.notify_admins(
    'New payout request',
    'A creator requested a payout. Review in admin.',
    'admin.html#payouts'
  );

  return payout_row;
end;
$$;
