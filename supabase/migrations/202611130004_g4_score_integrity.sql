-- Phase G.4: additive, isolated ledger. Existing G.1/G.3 leaderboards remain unchanged.
-- Important: server-accepted is NOT proof of microphone/Phaser gameplay correctness.
create table if not exists public.g4_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 world_index integer not null check (world_index between 0 and 3),
 challenge_index integer not null check (challenge_index between 0 and 7),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 constraint g4_attempt_world_bounds check (
  (world_index=0 and challenge_index<8) or
  (world_index in (1,2) and challenge_index<6) or
  (world_index=3 and challenge_index<4))
);
create index if not exists g4_attempt_user_idx on public.g4_attempts(user_id,started_at desc);
alter table public.g4_attempts enable row level security;
revoke all on public.g4_attempts from public,anon,authenticated;
-- Attempts are intentionally inaccessible directly to clients.

create table if not exists public.g4_score_events (
 event_id uuid primary key references public.g4_attempts(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 world_index integer not null,
 challenge_index integer not null,
 xp integer not null default 100 check (xp=100),
 accepted_at timestamptz not null default now(),
 week_start date not null,
 season_start date not null
);
create index if not exists g4_score_events_user_idx on public.g4_score_events(user_id,accepted_at desc);
create index if not exists g4_score_events_week_idx on public.g4_score_events(week_start,user_id);
create index if not exists g4_score_events_season_idx on public.g4_score_events(season_start,user_id);
alter table public.g4_score_events enable row level security;
revoke all on public.g4_score_events from public,anon,authenticated;
grant select on public.g4_score_events to authenticated;
create policy "g4 events owner read" on public.g4_score_events
 for select to authenticated using ((select auth.uid())=user_id);

create table if not exists public.g4_security_flags (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in ('rapid_start','rapid_finish','too_many_attempts','out_of_sequence','too_many_completions')),
 created_at timestamptz not null default now()
);
create index if not exists g4_flags_user_idx on public.g4_security_flags(user_id,created_at desc);
alter table public.g4_security_flags enable row level security;
revoke all on public.g4_security_flags from public,anon,authenticated;
-- No public read or write of flags; audit through Supabase admin/SQL only.

create table if not exists public.g4_player_names (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(display_name) between 1 and 24),
 updated_at timestamptz not null default now()
);
alter table public.g4_player_names enable row level security;
revoke all on public.g4_player_names from public,anon,authenticated;
grant select on public.g4_player_names to anon,authenticated;
create policy "g4 public display names" on public.g4_player_names for select to anon,authenticated using(true);

create or replace function public.g4_start_attempt(p_world integer,p_challenge integer)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid();v_id uuid;v_last record;
begin
 if v_uid is null then raise exception 'Authentication required';end if;
 if p_world is null or p_challenge is null or not (
  (p_world=0 and p_challenge between 0 and 7) or
  (p_world in (1,2) and p_challenge between 0 and 5) or
  (p_world=3 and p_challenge between 0 and 3))
 then raise exception 'Invalid challenge';end if;
 -- Serialize attempts for this user, including concurrent devices.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 42));
 if (select count(*) from public.g4_attempts where user_id=v_uid and started_at>now()-interval '1 hour')>=120 then
  insert into public.g4_security_flags(user_id,reason) values(v_uid,'too_many_attempts');
  return null; -- Preserve flag; do not raise/roll back transaction.
 end if;
 if exists(select 1 from public.g4_attempts where user_id=v_uid and started_at>now()-interval '2 seconds') then
  insert into public.g4_security_flags(user_id,reason) values(v_uid,'rapid_start');
  -- Do not reject: scene may retry rapidly.
 end if;
 select world_index,challenge_index into v_last from public.g4_score_events
 where user_id=v_uid order by accepted_at desc limit 1;
 if found and v_last.world_index=p_world and p_challenge>v_last.challenge_index+1 then
  insert into public.g4_security_flags(user_id,reason) values(v_uid,'out_of_sequence');
 end if;
 insert into public.g4_attempts(user_id,world_index,challenge_index)
 values(v_uid,p_world,p_challenge) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.g4_start_attempt(integer,integer) from public,anon;
grant execute on function public.g4_start_attempt(integer,integer) to authenticated;

create or replace function public.g4_finish_attempt(p_attempt uuid,p_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid();v_attempt public.g4_attempts%rowtype;v_count integer;
 v_week date:=(date_trunc('week',now() at time zone 'UTC'))::date;
 v_season date:=(date_trunc('month',now() at time zone 'UTC'))::date;
begin
 if v_uid is null then raise exception 'Authentication required';end if;
 if p_attempt is null or p_name is null or length(btrim(p_name)) not between 1 and 24
 then raise exception 'Invalid submission';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,42));
 select * into v_attempt from public.g4_attempts where id=p_attempt and user_id=v_uid for update;
 if not found then raise exception 'Attempt not found';end if;
 if v_attempt.completed_at is not null then
  return jsonb_build_object('accepted',false,'duplicate',true,'xp',0);
 end if;
 if now()-v_attempt.started_at<interval '3 seconds' then
  insert into public.g4_security_flags(user_id,reason) values(v_uid,'rapid_finish');
  return jsonb_build_object('accepted',false,'duplicate',false,'xp',0,'reason','rapid_finish');
 end if;
 if now()-v_attempt.started_at>interval '30 minutes' then raise exception 'Attempt expired';end if;
 select count(*) into v_count from public.g4_score_events
 where user_id=v_uid and accepted_at>now()-interval '1 hour';
 if v_count>=60 then
  insert into public.g4_security_flags(user_id,reason) values(v_uid,'too_many_completions');
  return jsonb_build_object('accepted',false,'duplicate',false,'xp',0,'reason','rate_limited');
 end if;
 update public.g4_attempts set completed_at=now() where id=p_attempt;
 insert into public.g4_score_events(event_id,user_id,world_index,challenge_index,week_start,season_start)
 values(p_attempt,v_uid,v_attempt.world_index,v_attempt.challenge_index,v_week,v_season);
 insert into public.g4_player_names(user_id,display_name) values(v_uid,btrim(p_name))
 on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
 return jsonb_build_object('accepted',true,'duplicate',false,'xp',100);
end $$;
revoke all on function public.g4_finish_attempt(uuid,text) from public,anon;
grant execute on function public.g4_finish_attempt(uuid,text) to authenticated;

-- No direct public views: rankings exposed exclusively through an aggregate-only RPC.
create or replace function public.g4_verified_rankings(p_period text default 'all')
returns table(user_id uuid,display_name text,xp bigint,challenges bigint)
language plpgsql stable security definer set search_path=''
as $$
begin
 if p_period not in ('all','week','season') or p_period is null then raise exception 'Invalid period';end if;
 return query select e.user_id,n.display_name,sum(e.xp)::bigint,count(*)::bigint
 from public.g4_score_events e join public.g4_player_names n on n.user_id=e.user_id
 where (p_period='all' or (p_period='week' and e.week_start=(date_trunc('week',now() at time zone 'UTC'))::date)
 or (p_period='season' and e.season_start=(date_trunc('month',now() at time zone 'UTC'))::date))
 group by e.user_id,n.display_name order by sum(e.xp) desc,count(*) desc limit 50;
end $$;
revoke all on function public.g4_verified_rankings(text) from public;
grant execute on function public.g4_verified_rankings(text) to anon,authenticated;

create or replace function public.g4_my_integrity()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Authentication required';end if;
 return jsonb_build_object(
 'verified_xp',(select coalesce(sum(xp),0) from public.g4_score_events where user_id=v_uid),
 'verified_events',(select count(*) from public.g4_score_events where user_id=v_uid),
 'flag_count',(select count(*) from public.g4_security_flags where user_id=v_uid)
 );
end $$;
revoke all on function public.g4_my_integrity() from public,anon;
grant execute on function public.g4_my_integrity() to authenticated;
