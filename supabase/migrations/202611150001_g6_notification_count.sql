-- G.6 hotfix: minimal private inbox count for dashboard badge.
-- Requires G.6 base migration. No direct table write privileges changed.
create or replace function public.g6_notification_count()
returns integer language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=auth.uid();v_count integer;
begin
 if u is null then raise exception 'Authentication required';end if;
 select (
  (select count(*) from public.g6_friend_requests r
   where r.recipient_id=u and r.status='pending'
    and not exists(select 1 from public.g6_blocks b where
     (b.blocker_id=u and b.blocked_id=r.sender_id) or
     (b.blocker_id=r.sender_id and b.blocked_id=u)))
  +
  (select count(*) from public.g6_matches m
   where m.opponent_id=u and m.status='pending'
    and m.created_at>=now()-interval '7 days'
    and not exists(select 1 from public.g6_blocks b where
     (b.blocker_id=u and b.blocked_id=m.challenger_id) or
     (b.blocker_id=m.challenger_id and b.blocked_id=u)))
 )::integer into v_count;
 return v_count;
end $$;
revoke all on function public.g6_notification_count() from public,anon;
grant execute on function public.g6_notification_count() to authenticated;
