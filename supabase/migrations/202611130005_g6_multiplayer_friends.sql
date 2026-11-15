-- Phase G.6: private friend graph and asynchronous challenges.
-- Matches use G.4 server-accepted events, NOT client-supplied scores.
-- G.4 events are not independently verified microphone evidence.
create table if not exists public.g6_friend_requests(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 check(sender_id<>recipient_id)
);
create unique index if not exists g6_one_pending_pair on public.g6_friend_requests(
 least(sender_id,recipient_id),greatest(sender_id,recipient_id)) where status='pending';
create index if not exists g6_friend_recipient on public.g6_friend_requests(recipient_id,created_at desc);
create index if not exists g6_friend_sender on public.g6_friend_requests(sender_id,created_at desc);
alter table public.g6_friend_requests enable row level security;
revoke all on public.g6_friend_requests from public,anon,authenticated;
grant select on public.g6_friend_requests to authenticated;
create policy "g6 request participants" on public.g6_friend_requests for select to authenticated
 using ((select auth.uid()) in (sender_id,recipient_id));

create table if not exists public.g6_blocks(
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);
alter table public.g6_blocks enable row level security;
revoke all on public.g6_blocks from public,anon,authenticated;
grant select on public.g6_blocks to authenticated;
create policy "g6 own blocks" on public.g6_blocks for select to authenticated
 using ((select auth.uid())=blocker_id);

create table if not exists public.g6_matches(
 id uuid primary key default gen_random_uuid(),
 challenger_id uuid not null references auth.users(id) on delete cascade,
 opponent_id uuid not null references auth.users(id) on delete cascade,
 world_index integer not null check(world_index between 0 and 3),
 status text not null default 'pending' check(status in ('pending','active','declined','cancelled','finished','expired')),
 created_at timestamptz not null default now(),
 accepted_at timestamptz,
 deadline_at timestamptz,
 challenger_score integer not null default 0 check(challenger_score between 0 and 600),
 opponent_score integer not null default 0 check(opponent_score between 0 and 600),
 resolved_at timestamptz,
 check(challenger_id<>opponent_id)
);
create index if not exists g6_matches_challenger on public.g6_matches(challenger_id,created_at desc);
create index if not exists g6_matches_opponent on public.g6_matches(opponent_id,created_at desc);
alter table public.g6_matches enable row level security;
revoke all on public.g6_matches from public,anon,authenticated;
grant select on public.g6_matches to authenticated;
create policy "g6 match participants" on public.g6_matches for select to authenticated
 using ((select auth.uid()) in (challenger_id,opponent_id));

-- All writes go through authenticated SECURITY DEFINER RPCs; direct writes revoked.
create or replace function public.g6_are_friends(a uuid,b uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.g6_friend_requests r
  where r.status='accepted'
   and ((r.sender_id=a and r.recipient_id=b) or (r.sender_id=b and r.recipient_id=a))
 ) and not exists(
  select 1 from public.g6_blocks x
  where (x.blocker_id=a and x.blocked_id=b) or (x.blocker_id=b and x.blocked_id=a)
 );
$$;
revoke all on function public.g6_are_friends(uuid,uuid) from public,anon,authenticated;

create or replace function public.g6_send_friend_request(p_target uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid:=auth.uid();v_id uuid;
begin
 if u is null then raise exception 'Authentication required';end if;
 if p_target is null or p_target=u then raise exception 'Invalid recipient';end if;
 if not exists(select 1 from auth.users where id=p_target) then raise exception 'Player not found';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(u,p_target)::text||greatest(u,p_target)::text,61));
 if exists(select 1 from public.g6_blocks where
  (blocker_id=u and blocked_id=p_target) or (blocker_id=p_target and blocked_id=u))
 then raise exception 'Request unavailable';end if;
 if public.g6_are_friends(u,p_target) then raise exception 'Already friends';end if;
 if exists(select 1 from public.g6_friend_requests where status='pending'
  and ((sender_id=u and recipient_id=p_target) or (sender_id=p_target and recipient_id=u)))
 then raise exception 'Request already pending';end if;
 if (select count(*) from public.g6_friend_requests where sender_id=u and created_at>now()-interval '1 hour')>=15
 then raise exception 'Friend request rate limit';end if;
 insert into public.g6_friend_requests(sender_id,recipient_id) values(u,p_target) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.g6_send_friend_request(uuid) from public,anon;
grant execute on function public.g6_send_friend_request(uuid) to authenticated;

create or replace function public.g6_respond_friend_request(p_id uuid,p_accept boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare u uuid:=auth.uid();r public.g6_friend_requests%rowtype;
begin
 if u is null then raise exception 'Authentication required';end if;
 select * into r from public.g6_friend_requests where id=p_id for update;
 if not found or r.recipient_id<>u or r.status<>'pending' then raise exception 'Request unavailable';end if;
 if exists(select 1 from public.g6_blocks where
  (blocker_id=u and blocked_id=r.sender_id) or (blocker_id=r.sender_id and blocked_id=u))
 then raise exception 'Request unavailable';end if;
 update public.g6_friend_requests set status=case when p_accept then 'accepted' else 'declined' end,
 responded_at=now() where id=p_id;
 return true;
end $$;
revoke all on function public.g6_respond_friend_request(uuid,boolean) from public,anon;
grant execute on function public.g6_respond_friend_request(uuid,boolean) to authenticated;

create or replace function public.g6_block_player(p_target uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Authentication required';end if;
 if p_target is null or p_target=u then raise exception 'Invalid player';end if;
 insert into public.g6_blocks(blocker_id,blocked_id) values(u,p_target) on conflict do nothing;
 update public.g6_friend_requests set status='cancelled',responded_at=now()
 where status in ('pending','accepted') and
 ((sender_id=u and recipient_id=p_target) or (sender_id=p_target and recipient_id=u));
 update public.g6_matches set status='cancelled',resolved_at=now()
 where status in ('pending','active') and
 ((challenger_id=u and opponent_id=p_target) or (challenger_id=p_target and opponent_id=u));
 return true;
end $$;
revoke all on function public.g6_block_player(uuid) from public,anon;
grant execute on function public.g6_block_player(uuid) to authenticated;

create or replace function public.g6_unblock_player(p_target uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 delete from public.g6_blocks where blocker_id=auth.uid() and blocked_id=p_target;
 return true;
end $$;
revoke all on function public.g6_unblock_player(uuid) from public,anon;
grant execute on function public.g6_unblock_player(uuid) to authenticated;

create or replace function public.g6_create_match(p_opponent uuid,p_world integer)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid:=auth.uid();v_id uuid;
begin
 if u is null then raise exception 'Authentication required';end if;
 if p_opponent is null or p_world not between 0 and 3 or p_opponent=u then raise exception 'Invalid match';end if;
 if not public.g6_are_friends(u,p_opponent) then raise exception 'Only friends can challenge';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,62));
 if (select count(*) from public.g6_matches where challenger_id=u and created_at>now()-interval '1 hour')>=10
 then raise exception 'Match invitation rate limit';end if;
 if exists(select 1 from public.g6_matches where challenger_id=u and opponent_id=p_opponent and status in ('pending','active'))
 then raise exception 'An open match already exists';end if;
 insert into public.g6_matches(challenger_id,opponent_id,world_index) values(u,p_opponent,p_world) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.g6_create_match(uuid,integer) from public,anon;
grant execute on function public.g6_create_match(uuid,integer) to authenticated;

create or replace function public.g6_respond_match(p_id uuid,p_accept boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare u uuid:=auth.uid();m public.g6_matches%rowtype;
begin
 if u is null then raise exception 'Authentication required';end if;
 select * into m from public.g6_matches where id=p_id for update;
 if not found or m.opponent_id<>u or m.status<>'pending' then raise exception 'Invitation unavailable';end if;
 if m.created_at<now()-interval '7 days' then
  update public.g6_matches set status='expired',resolved_at=now() where id=p_id;
  return false;
 end if;
 if not public.g6_are_friends(m.challenger_id,m.opponent_id) then raise exception 'Friendship required';end if;
 update public.g6_matches set status=case when p_accept then 'active' else 'declined' end,
 accepted_at=case when p_accept then now() else null end,
 deadline_at=case when p_accept then now()+interval '24 hours' else null end,
 resolved_at=case when p_accept then null else now() end
 where id=p_id;
 return true;
end $$;
revoke all on function public.g6_respond_match(uuid,boolean) from public,anon;
grant execute on function public.g6_respond_match(uuid,boolean) to authenticated;

-- Each participant scores at most 6 distinct challenges of the selected world.
-- Accepted G.4 events after match acceptance and before deadline only.
-- Match score is computed exclusively on server; repeated finalize is idempotent.
create or replace function public.g6_finalize_match(p_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid:=auth.uid();m public.g6_matches%rowtype;v_a integer;v_b integer;
begin
 if u is null then raise exception 'Authentication required';end if;
 select * into m from public.g6_matches where id=p_id for update;
 if not found or u not in (m.challenger_id,m.opponent_id) then raise exception 'Match unavailable';end if;
 if m.status='finished' then return jsonb_build_object('status','finished','challenger_score',m.challenger_score,'opponent_score',m.opponent_score);end if;
 if m.status<>'active' then raise exception 'Match not active';end if;
 -- No early finalization: both participants get the full 24h window.
 if now()<m.deadline_at then raise exception 'Match still active';end if;
 select count(*)*100 into v_a from (
  select distinct on (challenge_index) challenge_index from public.g4_score_events
  where user_id=m.challenger_id and world_index=m.world_index
   and accepted_at>=m.accepted_at and accepted_at<=m.deadline_at
  order by challenge_index,accepted_at
  limit 6
 ) s;
 select count(*)*100 into v_b from (
  select distinct on (challenge_index) challenge_index from public.g4_score_events
  where user_id=m.opponent_id and world_index=m.world_index
   and accepted_at>=m.accepted_at and accepted_at<=m.deadline_at
  order by challenge_index,accepted_at
  limit 6
 ) s;
 update public.g6_matches set status='finished',challenger_score=v_a,opponent_score=v_b,resolved_at=now() where id=p_id;
 return jsonb_build_object('status','finished','challenger_score',v_a,'opponent_score',v_b);
end $$;
revoke all on function public.g6_finalize_match(uuid) from public,anon;
grant execute on function public.g6_finalize_match(uuid) to authenticated;

create or replace function public.g6_dashboard()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=auth.uid();v jsonb;
begin
 if u is null then raise exception 'Authentication required';end if;
 select jsonb_build_object(
 'my_id',u,
 'blocked',coalesce((
  select jsonb_agg(jsonb_build_object('id',b.blocked_id,'name',coalesce(n.display_name,'Adventurer')) order by b.created_at desc)
  from public.g6_blocks b left join public.g4_player_names n on n.user_id=b.blocked_id
  where b.blocker_id=u
 ),'[]'::jsonb),
 'friends',coalesce((
  select jsonb_agg(jsonb_build_object('id',f.friend_id,'name',coalesce(n.display_name,'Adventurer')) order by coalesce(n.display_name,'Adventurer'))
  from (
   select distinct case when sender_id=u then recipient_id else sender_id end friend_id
   from public.g6_friend_requests
   where status='accepted' and u in (sender_id,recipient_id)
  ) f left join public.g4_player_names n on n.user_id=f.friend_id
  where public.g6_are_friends(u,f.friend_id)
 ),'[]'::jsonb),
 'requests',coalesce((
  select jsonb_agg(jsonb_build_object('id',r.id,'sender_id',r.sender_id,
    'sender_name',coalesce(n.display_name,'Adventurer'),'created_at',r.created_at) order by r.created_at desc)
  from public.g6_friend_requests r left join public.g4_player_names n on n.user_id=r.sender_id
  where r.recipient_id=u and r.status='pending'
   and not exists(select 1 from public.g6_blocks b where b.blocker_id=u and b.blocked_id=r.sender_id)
 ),'[]'::jsonb),
 'matches',coalesce((
  select jsonb_agg(jsonb_build_object('id',m.id,'challenger_id',m.challenger_id,
   'opponent_id',m.opponent_id,'world_index',m.world_index,'status',m.status,
   'created_at',m.created_at,'deadline_at',m.deadline_at,
   'challenger_score',m.challenger_score,'opponent_score',m.opponent_score,
   'challenger_name',coalesce(c.display_name,'Adventurer'),
   'opponent_name',coalesce(o.display_name,'Adventurer')) order by m.created_at desc)
  from (select * from public.g6_matches where u in (challenger_id,opponent_id)
    order by created_at desc limit 100) m
  left join public.g4_player_names c on c.user_id=m.challenger_id
  left join public.g4_player_names o on o.user_id=m.opponent_id
 ),'[]'::jsonb),
 'rankings',coalesce((
  select jsonb_agg(jsonb_build_object('id',s.friend_id,'name',coalesce(n.display_name,'Adventurer'),
   'wins',s.wins,'draws',s.draws,'played',s.played) order by s.wins desc,s.played desc)
  from (
   select p.friend_id,
    count(*) filter(where p.points>p.other_points)::integer wins,
    count(*) filter(where p.points=p.other_points)::integer draws,
    count(*)::integer played
   from (
    select m.challenger_id friend_id,m.challenger_score points,m.opponent_score other_points
      from public.g6_matches m where m.status='finished'
    union all
    select m.opponent_id,m.opponent_score,m.challenger_score
      from public.g6_matches m where m.status='finished'
   ) p
   where p.friend_id=u or public.g6_are_friends(u,p.friend_id)
   group by p.friend_id
  ) s left join public.g4_player_names n on n.user_id=s.friend_id
 ),'[]'::jsonb)
 ) into v;
 return v;
end $$;
revoke all on function public.g6_dashboard() from public,anon;
grant execute on function public.g6_dashboard() to authenticated;
