-- G.3: UTC Monday weeks, UTC calendar-month seasons. Client-submitted progress is NOT anti-cheat verified.
create table if not exists public.player_weekly_scores (
 user_id uuid not null references auth.users(id) on delete cascade,
 week_start date not null,
 display_name text not null check (char_length(display_name) between 1 and 24),
 xp integer not null default 0 check (xp between 0 and 100000000),
 challenges integer not null default 0 check (challenges between 0 and 100000),
 active_days integer not null default 0 check (active_days between 0 and 7),
 worlds integer not null default 0 check (worlds between 0 and 10000),
 updated_at timestamptz not null default now(),
 primary key(user_id,week_start)
);
create index if not exists weekly_scores_rank_idx on public.player_weekly_scores(week_start,xp desc,challenges desc);
alter table public.player_weekly_scores enable row level security;
revoke all on public.player_weekly_scores from anon,authenticated;
grant select on public.player_weekly_scores to anon,authenticated;
drop policy if exists "weekly public read" on public.player_weekly_scores;
create policy "weekly public read" on public.player_weekly_scores for select to anon,authenticated using(true);

create table if not exists public.player_season_scores (
 user_id uuid not null references auth.users(id) on delete cascade,
 season_start date not null,
 display_name text not null check (char_length(display_name) between 1 and 24),
 xp integer not null default 0 check (xp between 0 and 100000000),
 updated_at timestamptz not null default now(),
 primary key(user_id,season_start)
);
create index if not exists season_scores_rank_idx on public.player_season_scores(season_start,xp desc);
alter table public.player_season_scores enable row level security;
revoke all on public.player_season_scores from anon,authenticated;
grant select on public.player_season_scores to anon,authenticated;
drop policy if exists "season public read" on public.player_season_scores;
create policy "season public read" on public.player_season_scores for select to anon,authenticated using(true);

create table if not exists public.player_weekly_rewards (
 user_id uuid not null references auth.users(id) on delete cascade,
 week_start date not null,
 reward_code text not null check(reward_code in ('weekly_speaker','weekly_regular','weekly_explorer')),
 claimed_at timestamptz not null default now(),
 primary key(user_id,week_start,reward_code)
);
alter table public.player_weekly_rewards enable row level security;
revoke all on public.player_weekly_rewards from anon,authenticated;
grant select on public.player_weekly_rewards to authenticated;
drop policy if exists "weekly rewards owner read" on public.player_weekly_rewards;
create policy "weekly rewards owner read" on public.player_weekly_rewards for select to authenticated using ((select auth.uid())=user_id);

-- Derive time boundaries on PostgreSQL rather than trusting device clock.
create or replace function public.g3_periods()
returns jsonb language sql stable security invoker set search_path=''
as $$
 select jsonb_build_object(
  'server_time',now(),
  'week_start',(date_trunc('week',now() at time zone 'UTC'))::date,
  'week_end',((date_trunc('week',now() at time zone 'UTC')) + interval '7 days'),
  'season_start',(date_trunc('month',now() at time zone 'UTC'))::date,
  'season_end',((date_trunc('month',now() at time zone 'UTC')) + interval '1 month')
 )
$$;
revoke all on function public.g3_periods() from public;
grant execute on function public.g3_periods() to anon,authenticated;

create or replace function public.g3_submit_progress(
 p_name text,p_week_xp integer,p_challenges integer,p_active_days integer,p_worlds integer,p_season_xp integer
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_week date:=(date_trunc('week',now() at time zone 'UTC'))::date;
 v_season date:=(date_trunc('month',now() at time zone 'UTC'))::date;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_name is null or length(btrim(p_name))=0 or length(p_name)>24
 or p_week_xp not between 0 and 100000000 or p_season_xp not between 0 and 100000000
 or p_challenges not between 0 and 100000 or p_active_days not between 0 and 7
 or p_worlds not between 0 and 10000 then raise exception 'Invalid progress';end if;
 insert into public.player_weekly_scores(user_id,week_start,display_name,xp,challenges,active_days,worlds)
 values(v_user,v_week,btrim(p_name),p_week_xp,p_challenges,p_active_days,p_worlds)
 on conflict(user_id,week_start) do update set display_name=excluded.display_name,
 xp=greatest(public.player_weekly_scores.xp,excluded.xp),
 challenges=greatest(public.player_weekly_scores.challenges,excluded.challenges),
 active_days=greatest(public.player_weekly_scores.active_days,excluded.active_days),
 worlds=greatest(public.player_weekly_scores.worlds,excluded.worlds),updated_at=now();
 insert into public.player_season_scores(user_id,season_start,display_name,xp)
 values(v_user,v_season,btrim(p_name),p_season_xp)
 on conflict(user_id,season_start) do update set display_name=excluded.display_name,
 xp=greatest(public.player_season_scores.xp,excluded.xp),updated_at=now();
 return jsonb_build_object('week_start',v_week,'season_start',v_season);
end $$;
revoke all on function public.g3_submit_progress(text,integer,integer,integer,integer,integer) from public,anon;
grant execute on function public.g3_submit_progress(text,integer,integer,integer,integer,integer) to authenticated;

create or replace function public.g3_claim_weekly_reward(p_reward_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_week date:=(date_trunc('week',now() at time zone 'UTC'))::date;
 v_score public.player_weekly_scores%rowtype;v_count integer:=0;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_reward_code not in ('weekly_speaker','weekly_regular','weekly_explorer') or p_reward_code is null
 then raise exception 'Unknown reward';end if;
 select * into v_score from public.player_weekly_scores where user_id=v_user and week_start=v_week;
 if not found then raise exception 'Submit weekly progress first';end if;
 if (p_reward_code='weekly_speaker' and v_score.challenges<20)
 or (p_reward_code='weekly_regular' and v_score.active_days<5)
 or (p_reward_code='weekly_explorer' and v_score.worlds<2)
 then raise exception 'Challenge not complete';end if;
 insert into public.player_weekly_rewards(user_id,week_start,reward_code)
 values(v_user,v_week,p_reward_code) on conflict do nothing;
 get diagnostics v_count = row_count;
 return jsonb_build_object('claimed',(v_count > 0),'reward_code',p_reward_code,'week_start',v_week);
end $$;
revoke all on function public.g3_claim_weekly_reward(text) from public,anon;
grant execute on function public.g3_claim_weekly_reward(text) to authenticated;
