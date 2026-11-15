-- G.8 Competitive Events: additive, private writes, server-authoritative outcomes.
create table public.g8_seasons(id uuid primary key default gen_random_uuid(),name text not null,starts_at timestamptz not null,ends_at timestamptz not null,created_at timestamptz not null default now(),check(ends_at>starts_at));
create table public.g8_season_players(season_id uuid not null references public.g8_seasons(id),user_id uuid not null references auth.users(id) on delete cascade,rp integer not null default 100 check(rp>=0),played integer not null default 0,won integer not null default 0,primary key(season_id,user_id));
create table public.g8_rating_events(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.g8_seasons(id),match_id uuid not null references public.g6_matches(id),user_id uuid not null references auth.users(id) on delete cascade,delta integer not null,result text not null check(result in ('win','draw','loss')),created_at timestamptz not null default now(),unique(match_id,user_id));
create table public.g8_tournaments(id uuid primary key default gen_random_uuid(),season_id uuid references public.g8_seasons(id),name text not null,kind text not null check(kind in ('daily','weekly')),world_index integer not null check(world_index between 0 and 3),challenge_count integer not null default 4 check(challenge_count between 1 and 4),starts_at timestamptz not null,ends_at timestamptz not null,content_version text not null default 'levels-v1',status text not null default 'open' check(status in ('open','closed')),check(ends_at>starts_at));
create table public.g8_tournament_entries(id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.g8_tournaments(id),user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),score integer not null default 0 check(score between 0 and 400),status text not null default 'registered' check(status in ('registered','submitted')),unique(tournament_id,user_id));
create table public.g8_tournament_attempts(id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.g8_tournament_entries(id),challenge_index integer not null check(challenge_index between 0 and 7),g4_attempt_id uuid unique,created_at timestamptz not null default now(),accepted boolean not null default false,unique(entry_id,challenge_index));
create table public.g8_competitive_matches(match_id uuid primary key references public.g6_matches(id),season_id uuid not null references public.g8_seasons(id),created_at timestamptz not null default now(),status text not null default 'pending' check(status in ('pending','rated','review')));
create table public.g8_matchmaking_queue(user_id uuid primary key references auth.users(id) on delete cascade,season_id uuid not null references public.g8_seasons(id),world_index integer not null check(world_index between 0 and 3),joined_at timestamptz not null default now(),rating integer not null);
create table public.g8_achievements(code text primary key,title text not null,description text not null);
create table public.g8_reward_grants(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,achievement_code text not null references public.g8_achievements(code),season_id uuid references public.g8_seasons(id),source_id uuid not null,created_at timestamptz not null default now(),unique(user_id,achievement_code,source_id));
create table public.g8_integrity_flags(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,match_id uuid references public.g6_matches(id),reason text not null,status text not null default 'open' check(status in ('open','reviewed','dismissed')),created_at timestamptz not null default now());
create index g8_tournament_entries_ranking on public.g8_tournament_entries(tournament_id,score desc);
create index g8_rating_events_season on public.g8_rating_events(season_id,user_id);
create index g8_matchmaking_lookup on public.g8_matchmaking_queue(season_id,world_index,rating,joined_at);
do $$ declare t text;begin foreach t in array array['g8_seasons','g8_season_players','g8_rating_events','g8_tournaments','g8_tournament_entries','g8_tournament_attempts','g8_competitive_matches','g8_matchmaking_queue','g8_achievements','g8_reward_grants','g8_integrity_flags'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
end loop;end $$;
grant select on public.g8_seasons,public.g8_tournaments,public.g8_achievements to authenticated;
create policy g8_seasons_read on public.g8_seasons for select to authenticated using(true);
create policy g8_tournaments_read on public.g8_tournaments for select to authenticated using(true);
create policy g8_achievements_read on public.g8_achievements for select to authenticated using(true);
grant select on public.g8_season_players,public.g8_tournament_entries,public.g8_rating_events,public.g8_reward_grants,public.g8_matchmaking_queue to authenticated;
create policy g8_ratings_read on public.g8_season_players for select to authenticated using(true);
create policy g8_entries_read on public.g8_tournament_entries for select to authenticated using(true);
create policy g8_rating_history on public.g8_rating_events for select to authenticated using(user_id=auth.uid());
create policy g8_my_rewards on public.g8_reward_grants for select to authenticated using(user_id=auth.uid());
create policy g8_my_queue on public.g8_matchmaking_queue for select to authenticated using(user_id=auth.uid());
insert into public.g8_achievements(code,title,description) values
('first_match','First Challenger','Hoàn thành trận xếp hạng đầu tiên'),
('five_wins','Rising Star','Thắng năm trận trong một mùa'),
('weekly_champion','Weekly Champion','Dẫn đầu giải tuần khi kết thúc'),
('daily_streak','Consistent Learner','Hoàn thành bảy giải ngày khác nhau'),
('diamond','Season Diamond','Đạt 400 RP khi kết thúc mùa')
on conflict do nothing;
-- Admin config is deliberately not exposed to authenticated users. Operator creates seasons/events in SQL Editor.
create or replace function public.g8_current_season() returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(s) from public.g8_seasons s where now()>=s.starts_at and now()<s.ends_at order by s.starts_at desc limit 1
$$;
create or replace function public.g8_season_rankings(p_season uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid;outcome jsonb;
begin
 select coalesce(p_season,(select id from public.g8_seasons where now()>=starts_at and now()<ends_at order by starts_at desc limit 1)) into sid;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.rp desc,r.won desc,r.user_id),'[]'::jsonb) into outcome
 from (select p.user_id,coalesce(n.display_name,'Adventurer') display_name,p.rp,p.played,p.won
 from public.g8_season_players p left join public.g4_player_names n on n.user_id=p.user_id
 where p.season_id=sid order by p.rp desc,p.won desc,p.user_id limit 50) r;
 return outcome;
end $$;
create or replace function public.g8_join_tournament(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t public.g8_tournaments%rowtype;entry uuid;
begin
 if u is null then raise exception 'Authentication required';end if;
 select * into t from public.g8_tournaments where id=p_id and status='open' and now() between starts_at and ends_at;
 if not found then raise exception 'Tournament unavailable';end if;
 insert into public.g8_tournament_entries(tournament_id,user_id) values(p_id,u)
 on conflict(tournament_id,user_id) do update set tournament_id=excluded.tournament_id returning id into entry;
 return entry;
end $$;
-- Explicit tournament session; do not accept ordinary G.4 events as competition entries.
-- For G.8 MVP the server issues a dedicated G.4 attempt ticket, and verifies its accepted event.
create or replace function public.g8_start_tournament_attempt(p_entry uuid,p_challenge integer) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();e record;v uuid;
begin
 if u is null then raise exception 'Authentication required';end if;
 select e.id,e.user_id,e.status,t.world_index,t.challenge_count,t.ends_at,t.starts_at into e
 from public.g8_tournament_entries e join public.g8_tournaments t on t.id=e.tournament_id
 where e.id=p_entry for update of e;
 if not found or e.user_id<>u or e.status<>'registered' or now()<e.starts_at or now()>=e.ends_at
 or p_challenge is null or p_challenge<0 or p_challenge>=e.challenge_count then raise exception 'Attempt unavailable';end if;
 if exists(select 1 from public.g8_tournament_attempts where entry_id=p_entry and challenge_index=p_challenge) then raise exception 'Already attempted';end if;
 v:=public.g4_start_attempt(e.world_index,p_challenge);
 if v is null then raise exception 'G.4 attempt limit reached';end if;
 insert into public.g8_tournament_attempts(entry_id,challenge_index,g4_attempt_id) values(p_entry,p_challenge,v);
 return v;
end $$;
create or replace function public.g8_finish_tournament_attempt(p_entry uuid,p_challenge integer,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();a record;result jsonb;ok boolean;
begin
 if u is null then raise exception 'Authentication required';end if;
 select a.*,e.user_id,t.ends_at into a from public.g8_tournament_attempts a
 join public.g8_tournament_entries e on e.id=a.entry_id
 join public.g8_tournaments t on t.id=e.tournament_id
 where a.entry_id=p_entry and a.challenge_index=p_challenge for update of a;
 if not found or a.user_id<>u or now()>a.ends_at then raise exception 'Attempt unavailable';end if;
 if a.accepted then return jsonb_build_object('accepted',true,'duplicate',true);end if;
 result:=public.g4_finish_attempt(a.g4_attempt_id,left(coalesce(p_name,'Adventurer'),24));
 ok:=coalesce((result->>'accepted')::boolean,false);
 if ok then
  update public.g8_tournament_attempts set accepted=true where id=a.id;
  update public.g8_tournament_entries set score=least(400,score+100) where id=p_entry;
 end if;
 return jsonb_build_object('accepted',ok,'duplicate',coalesce((result->>'duplicate')::boolean,false));
end $$;
create or replace function public.g8_tournament_rankings(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc,x.user_id),'[]'::jsonb)
 from (select e.user_id,coalesce(n.display_name,'Adventurer') display_name,e.score,e.status
 from public.g8_tournament_entries e left join public.g4_player_names n on n.user_id=e.user_id
 where e.tournament_id=p_id order by e.score desc,e.user_id limit 50) x
$$;
create or replace function public.g8_my_achievements() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('code',g.achievement_code,'title',a.title,'created_at',g.created_at) order by g.created_at desc),'[]'::jsonb)
 from public.g8_reward_grants g join public.g8_achievements a on a.code=g.achievement_code where g.user_id=auth.uid()
$$;
create or replace function public.g8_my_competitive_history() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from
 (select e.match_id,e.delta,e.result,e.created_at from public.g8_rating_events e where e.user_id=auth.uid() order by e.created_at desc limit 50) x
$$;
create or replace function public.g8_join_matchmaking(p_world integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();s uuid;r integer;other record;m uuid;delta integer;
begin
 if u is null or p_world is null or p_world not between 0 and 3 then raise exception 'Invalid matchmaking request';end if;
 select id into s from public.g8_seasons where now()>=starts_at and now()<ends_at order by starts_at desc limit 1;
 if s is null then raise exception 'No active season';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(s::text||':'||p_world::text,87));
 insert into public.g8_season_players(season_id,user_id) values(s,u) on conflict do nothing;
 select rp into r from public.g8_season_players where season_id=s and user_id=u;
 if exists(select 1 from public.g8_matchmaking_queue where user_id=u) then raise exception 'Already queued';end if;
 select q.* into other from public.g8_matchmaking_queue q
 where q.season_id=s and q.world_index=p_world and q.user_id<>u
 and not exists(select 1 from public.g6_blocks b where
 (b.blocker_id=u and b.blocked_id=q.user_id) or (b.blocker_id=q.user_id and b.blocked_id=u))
 and abs(q.rating-r)<=case when now()-q.joined_at>interval '90 seconds' then 200 when now()-q.joined_at>interval '30 seconds' then 100 else 50 end
 order by abs(q.rating-r),q.joined_at limit 1 for update skip locked;
 if not found then
  insert into public.g8_matchmaking_queue(user_id,season_id,world_index,rating) values(u,s,p_world,r);
  return jsonb_build_object('status','queued');
 end if;
 delete from public.g8_matchmaking_queue where user_id=other.user_id;
 -- Competitive matchmaking creates a G.6 match directly; no friendship requirement.
 insert into public.g6_matches(challenger_id,opponent_id,world_index,status,accepted_at,deadline_at)
 values(other.user_id,u,p_world,'active',now(),now()+interval '24 hours') returning id into m;
 insert into public.g8_competitive_matches(match_id,season_id) values(m,s);
 perform public.g7_emit(u,other.user_id,'match_accepted',m,'Đã ghép trận xếp hạng','Bạn đã được ghép trận G.8.');
 perform public.g7_emit(other.user_id,u,'match_accepted',m,'Đã ghép trận xếp hạng','Bạn đã được ghép trận G.8.');
 return jsonb_build_object('status','matched','match_id',m);
end $$;
create or replace function public.g8_cancel_matchmaking() returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 delete from public.g8_matchmaking_queue where user_id=auth.uid();return found;
end $$;
-- Run from trusted pg_cron/service role after G.7 finalizer; ratings/rewards are never client-submitted.
create or replace function public.g8_settle_competitive_matches(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare m record;da integer;db integer;n integer:=0;
begin
 for m in select c.match_id,c.season_id,g.challenger_id,g.opponent_id,g.challenger_score,g.opponent_score
 from public.g8_competitive_matches c join public.g6_matches g on g.id=c.match_id
 where c.status='pending' and g.status='finished'
 order by g.resolved_at for update of c skip locked limit least(greatest(coalesce(p_limit,100),1),500)
 loop
  -- Flag repeated pair farming for review, without automatic ban.
  if (select count(*) from public.g8_competitive_matches c2 join public.g6_matches g2 on g2.id=c2.match_id
   where c2.season_id=m.season_id and g2.status='finished'
   and ((g2.challenger_id=m.challenger_id and g2.opponent_id=m.opponent_id)
   or (g2.challenger_id=m.opponent_id and g2.opponent_id=m.challenger_id)))>5 then
   update public.g8_competitive_matches set status='review' where match_id=m.match_id;
   insert into public.g8_integrity_flags(user_id,match_id,reason) values(m.challenger_id,m.match_id,'Repeated opponent pair');
   continue;
  end if;
  da:=case when m.challenger_score>m.opponent_score then 20 when m.challenger_score=m.opponent_score then 5 else -10 end;
  db:=case when m.opponent_score>m.challenger_score then 20 when m.opponent_score=m.challenger_score then 5 else -10 end;
  insert into public.g8_season_players(season_id,user_id) values(m.season_id,m.challenger_id),(m.season_id,m.opponent_id) on conflict do nothing;
  insert into public.g8_rating_events(season_id,match_id,user_id,delta,result) values
  (m.season_id,m.match_id,m.challenger_id,da,case when da=20 then 'win' when da=5 then 'draw' else 'loss' end),
  (m.season_id,m.match_id,m.opponent_id,db,case when db=20 then 'win' when db=5 then 'draw' else 'loss' end);
  update public.g8_season_players set rp=greatest(0,rp+da),played=played+1,won=won+case when da=20 then 1 else 0 end where season_id=m.season_id and user_id=m.challenger_id;
  update public.g8_season_players set rp=greatest(0,rp+db),played=played+1,won=won+case when db=20 then 1 else 0 end where season_id=m.season_id and user_id=m.opponent_id;
  update public.g8_competitive_matches set status='rated' where match_id=m.match_id;
  insert into public.g8_reward_grants(user_id,achievement_code,season_id,source_id)
  values(m.challenger_id,'first_match',m.season_id,m.season_id),(m.opponent_id,'first_match',m.season_id,m.season_id) on conflict do nothing;
  insert into public.g8_reward_grants(user_id,achievement_code,season_id,source_id)
  select user_id,'five_wins',season_id,season_id from public.g8_season_players where season_id=m.season_id and won>=5 on conflict do nothing;
  n:=n+1;
 end loop;
 return n;
end $$;
do $$ declare sig text;begin foreach sig in array array[
 'g8_current_season()','g8_season_rankings(uuid)','g8_join_tournament(uuid)','g8_start_tournament_attempt(uuid,integer)','g8_finish_tournament_attempt(uuid,integer,text)',
 'g8_tournament_rankings(uuid)','g8_my_achievements()','g8_my_competitive_history()','g8_join_matchmaking(integer)','g8_cancel_matchmaking()','g8_settle_competitive_matches(integer)'] loop
 execute 'revoke all on function public.'||sig||' from public,anon,authenticated';
 if sig<>'g8_settle_competitive_matches(integer)' then execute 'grant execute on function public.'||sig||' to authenticated';end if;
end loop;end $$;
grant execute on function public.g8_settle_competitive_matches(integer) to service_role;
-- Operator: after enabling pg_cron, schedule (service-side only):
-- select cron.schedule('g8-settle-matches','* * * * *','select public.g8_settle_competitive_matches(100)');
-- IMPORTANT: G.8 tournaments require dedicated competition tickets; verify G.4 RPC compatibility on Preview.

-- Public event catalog; no private entry information.
create or replace function public.g8_list_tournaments() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at desc),'[]'::jsonb)
 from (select id,name,kind,world_index,challenge_count,starts_at,ends_at,status,content_version from public.g8_tournaments order by starts_at desc limit 50) t
$$;
create or replace function public.g8_matchmaking_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();m uuid;
begin
 if u is null then raise exception 'Authentication required';end if;
 if exists(select 1 from public.g8_matchmaking_queue where user_id=u) then return jsonb_build_object('status','queued');end if;
 select c.match_id into m from public.g8_competitive_matches c join public.g6_matches g on g.id=c.match_id
 where u in(g.challenger_id,g.opponent_id) and g.status in('active','finished')
 order by c.created_at desc limit 1;
 if m is not null then return jsonb_build_object('status','matched','match_id',m);end if;
 return jsonb_build_object('status','idle');
end $$;
revoke all on function public.g8_list_tournaments() from public,anon;
revoke all on function public.g8_matchmaking_status() from public,anon;
grant execute on function public.g8_list_tournaments(),public.g8_matchmaking_status() to authenticated;

-- Close ended events, grant non-monetary achievement badges and freeze season results.
create table public.g8_season_snapshots(
 season_id uuid not null references public.g8_seasons(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 final_rp integer not null,
 final_rank integer not null,
 created_at timestamptz not null default now(),
 primary key(season_id,user_id)
);
alter table public.g8_season_snapshots enable row level security;
revoke all on public.g8_season_snapshots from public,anon,authenticated;
grant select on public.g8_season_snapshots to authenticated;
create policy g8_snapshots_read on public.g8_season_snapshots for select to authenticated using(true);
create or replace function public.g8_settle_events()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare t record;s record;winner uuid;daily_count integer;closed_count integer:=0;season_count integer:=0;
begin
 for t in select * from public.g8_tournaments where status='open' and ends_at<=now() for update skip locked loop
  update public.g8_tournaments set status='closed' where id=t.id;
  if t.kind='weekly' then
   select user_id into winner from public.g8_tournament_entries
   where tournament_id=t.id and score>0 order by score desc,created_at asc,user_id limit 1;
   if winner is not null then
    insert into public.g8_reward_grants(user_id,achievement_code,season_id,source_id)
    values(winner,'weekly_champion',t.season_id,t.id) on conflict do nothing;
   end if;
  end if;
  closed_count:=closed_count+1;
 end loop;
 for s in select * from public.g8_seasons where ends_at<=now()
 and not exists(select 1 from public.g8_season_snapshots x where x.season_id=id)
 for update skip locked loop
  insert into public.g8_season_snapshots(season_id,user_id,final_rp,final_rank)
  select s.id,p.user_id,p.rp,row_number() over(order by p.rp desc,p.won desc,p.user_id)::integer
  from public.g8_season_players p where p.season_id=s.id on conflict do nothing;
  insert into public.g8_reward_grants(user_id,achievement_code,season_id,source_id)
  select p.user_id,'diamond',s.id,s.id from public.g8_season_players p
  where p.season_id=s.id and p.rp>=400 on conflict do nothing;
  season_count:=season_count+1;
 end loop;
 -- Count distinct completed daily events, grant once at seven.
 for winner in select e.user_id from public.g8_tournament_entries e join public.g8_tournaments t on t.id=e.tournament_id
 where t.kind='daily' and t.status='closed' and e.score>0 group by e.user_id
 having count(distinct (t.starts_at at time zone 'UTC')::date)>=7 loop
  insert into public.g8_reward_grants(user_id,achievement_code,source_id)
  values(winner,'daily_streak','00000000-0000-0000-0000-000000000008'::uuid) on conflict do nothing;
 end loop;
 return jsonb_build_object('tournaments_closed',closed_count,'seasons_frozen',season_count);
end $$;
revoke all on function public.g8_settle_events() from public,anon,authenticated;
grant execute on function public.g8_settle_events() to service_role;
-- Operator schedules both G.8 settlement jobs via trusted pg_cron:
-- select cron.schedule('g8-settle-matches','* * * * *','select public.g8_settle_competitive_matches(100)');
-- select cron.schedule('g8-settle-events','*/5 * * * *','select public.g8_settle_events()');
-- Do not enable Production scheduling without approval.
