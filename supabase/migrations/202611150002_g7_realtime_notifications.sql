-- G.7: durable private notifications and server-side finalization.
-- Apply after G.6 and the G.6 notification-count migration.
create table if not exists public.g7_notifications(
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 type text not null check(type in ('friend_request','friend_accepted','match_invitation','match_accepted','match_declined','match_finished')),
 entity_id uuid not null,
 title text not null,
 body text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 dismissed_at timestamptz,
 unique(recipient_id,type,entity_id)
);
create index if not exists g7_notifications_recipient on public.g7_notifications(recipient_id,created_at desc);
alter table public.g7_notifications enable row level security;
revoke all on public.g7_notifications from public,anon,authenticated;
grant select on public.g7_notifications to authenticated;
create policy "g7 recipient read" on public.g7_notifications for select to authenticated
 using ((select auth.uid())=recipient_id);
-- Postgres Changes only publishes rows after RLS verification. Do not expose service-role keys.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='g7_notifications') then
  alter publication supabase_realtime add table public.g7_notifications;
 end if;
end $$;

create or replace function public.g7_emit(p_recipient uuid,p_actor uuid,p_type text,p_entity uuid,p_title text,p_body text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 insert into public.g7_notifications(recipient_id,actor_id,type,entity_id,title,body)
 values(p_recipient,p_actor,p_type,p_entity,p_title,p_body)
 on conflict(recipient_id,type,entity_id) do nothing;
end $$;
revoke all on function public.g7_emit(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;

-- Triggers run in the same transaction as the existing G.6 RPCs.
create or replace function public.g7_friend_event()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='INSERT' and new.status='pending' then
  perform public.g7_emit(new.recipient_id,new.sender_id,'friend_request',new.id,'Lời mời kết bạn','Bạn có lời mời kết bạn mới.');
 elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='accepted' then
  perform public.g7_emit(new.sender_id,new.recipient_id,'friend_accepted',new.id,'Đã kết bạn','Lời mời kết bạn đã được chấp nhận.');
 end if;
 return new;
end $$;
drop trigger if exists g7_friend_notify on public.g6_friend_requests;
create trigger g7_friend_notify after insert or update of status on public.g6_friend_requests
for each row execute function public.g7_friend_event();

create or replace function public.g7_match_event()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='INSERT' and new.status='pending' then
  perform public.g7_emit(new.opponent_id,new.challenger_id,'match_invitation',new.id,'Lời thách đấu 1v1','Bạn nhận được lời thách đấu mới.');
 elsif tg_op='UPDATE' and old.status is distinct from new.status then
  if new.status='active' then
   perform public.g7_emit(new.challenger_id,new.opponent_id,'match_accepted',new.id,'Thách đấu được chấp nhận','Trận đấu 1v1 đã bắt đầu.');
  elsif new.status='declined' then
   perform public.g7_emit(new.challenger_id,new.opponent_id,'match_declined',new.id,'Thách đấu bị từ chối','Lời thách đấu đã bị từ chối.');
  elsif new.status='finished' then
   perform public.g7_emit(new.challenger_id,new.opponent_id,'match_finished',new.id,'Kết quả trận đấu','Trận 1v1 đã có kết quả.');
   perform public.g7_emit(new.opponent_id,new.challenger_id,'match_finished',new.id,'Kết quả trận đấu','Trận 1v1 đã có kết quả.');
  end if;
 end if;
 return new;
end $$;
drop trigger if exists g7_match_notify on public.g6_matches;
create trigger g7_match_notify after insert or update of status on public.g6_matches
for each row execute function public.g7_match_event();

create or replace function public.g7_notification_summary()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=auth.uid();v_unread integer;v_pending integer;
begin
 if u is null then raise exception 'Authentication required';end if;
 select count(*)::integer into v_unread from public.g7_notifications
 where recipient_id=u and read_at is null and dismissed_at is null;
 v_pending:=public.g6_notification_count();
 return jsonb_build_object('unread',v_unread,'pending',v_pending);
end $$;
revoke all on function public.g7_notification_summary() from public,anon;
grant execute on function public.g7_notification_summary() to authenticated;

create or replace function public.g7_list_notifications(p_limit integer default 30,p_before timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=auth.uid();v jsonb;
begin
 if u is null then raise exception 'Authentication required';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v
 from (select id,type,entity_id,title,body,created_at,read_at,actor_id
  from public.g7_notifications where recipient_id=u and dismissed_at is null
   and (p_before is null or created_at<p_before)
  order by created_at desc,id desc limit least(greatest(coalesce(p_limit,30),1),50)) x;
 return v;
end $$;
revoke all on function public.g7_list_notifications(integer,timestamptz) from public,anon;
grant execute on function public.g7_list_notifications(integer,timestamptz) to authenticated;

create or replace function public.g7_mark_notification_read(p_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 update public.g7_notifications set read_at=coalesce(read_at,now())
 where id=p_id and recipient_id=auth.uid() and dismissed_at is null;
 return found;
end $$;
revoke all on function public.g7_mark_notification_read(uuid) from public,anon;
grant execute on function public.g7_mark_notification_read(uuid) to authenticated;

create or replace function public.g7_mark_all_read()
returns integer language plpgsql security definer set search_path=''
as $$
declare n integer;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 update public.g7_notifications set read_at=now()
 where recipient_id=auth.uid() and read_at is null and dismissed_at is null;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.g7_mark_all_read() from public,anon;
grant execute on function public.g7_mark_all_read() to authenticated;

create or replace function public.g7_dismiss_notification(p_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 update public.g7_notifications set dismissed_at=coalesce(dismissed_at,now())
 where id=p_id and recipient_id=auth.uid();
 return found;
end $$;
revoke all on function public.g7_dismiss_notification(uuid) from public,anon;
grant execute on function public.g7_dismiss_notification(uuid) to authenticated;

create or replace function public.g7_match_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=auth.uid();v jsonb;
begin
 if u is null then raise exception 'Authentication required';end if;
 select jsonb_build_object('id',m.id,'challenger_id',m.challenger_id,'opponent_id',m.opponent_id,
  'challenger_name',coalesce(a.display_name,'Adventurer'),'opponent_name',coalesce(b.display_name,'Adventurer'),
  'world_index',m.world_index,'status',m.status,'accepted_at',m.accepted_at,
  'deadline_at',m.deadline_at,'challenger_score',m.challenger_score,
  'opponent_score',m.opponent_score,'resolved_at',m.resolved_at)
 into v from public.g6_matches m
 left join public.g4_player_names a on a.user_id=m.challenger_id
 left join public.g4_player_names b on b.user_id=m.opponent_id
 where m.id=p_id and u in(m.challenger_id,m.opponent_id);
 if v is null then raise exception 'Match unavailable';end if;
 return v;
end $$;
revoke all on function public.g7_match_detail(uuid) from public,anon;
grant execute on function public.g7_match_detail(uuid) to authenticated;

-- Dedicated server-only batch finalizer; no user may call it.
-- FOR UPDATE SKIP LOCKED and status guard make retries/concurrent workers safe.
create or replace function public.g7_finalize_due_matches(p_batch integer default 100)
returns integer language plpgsql security definer set search_path=''
as $$
declare m record;v_a integer;v_b integer;n integer:=0;
begin
 for m in select * from public.g6_matches
  where status='active' and deadline_at<=now()
  order by deadline_at,id for update skip locked
  limit least(greatest(coalesce(p_batch,100),1),500)
 loop
  select count(*)*100 into v_a from (
   select distinct challenge_index from public.g4_score_events
   where user_id=m.challenger_id and world_index=m.world_index
    and accepted_at>=m.accepted_at and accepted_at<=m.deadline_at
   order by challenge_index limit 6
  ) a;
  select count(*)*100 into v_b from (
   select distinct challenge_index from public.g4_score_events
   where user_id=m.opponent_id and world_index=m.world_index
    and accepted_at>=m.accepted_at and accepted_at<=m.deadline_at
   order by challenge_index limit 6
  ) b;
  update public.g6_matches set status='finished',challenger_score=v_a,
   opponent_score=v_b,resolved_at=now() where id=m.id and status='active';
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.g7_finalize_due_matches(integer) from public,anon,authenticated;
grant execute on function public.g7_finalize_due_matches(integer) to service_role;

-- Install/schedule automatically where pg_cron is already enabled.
-- On projects without pg_cron, enable it and rerun this block manually.
do $g7cron$
begin
 if exists(select 1 from pg_extension where extname='pg_cron')
    and exists(select 1 from pg_namespace where nspname='cron') then
  if not exists(select 1 from cron.job where jobname='g7-finalize-due-matches') then
   perform cron.schedule('g7-finalize-due-matches','* * * * *',
    'select public.g7_finalize_due_matches(100)');
  end if;
 end if;
end $g7cron$;
-- Production gate: verify cron.job and cron.job_run_details, or explicitly
-- enable pg_cron and schedule the above job before declaring auto-finalization live.
-- Never expose the finalizer to authenticated clients.
