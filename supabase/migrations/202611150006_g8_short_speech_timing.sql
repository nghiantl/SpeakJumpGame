-- G.8 speech timing hotfix.
-- G.4 regular attempts retain their original 3-second minimum.
-- Only server-linked G.8 tournament tickets use a 400ms minimum.
-- This reduces false positives for short words, but does not prove real speech:
-- G.4/G.8 still rely on client-side recognition and cannot verify microphone audio.
-- Apply to isolated Preview first; this replaces a SECURITY DEFINER function.
create or replace function public.g4_finish_attempt(p_attempt uuid,p_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid();v_attempt public.g4_attempts%rowtype;v_count integer;
 v_is_g8 boolean:=false;
 v_min_duration interval:=interval '3 seconds';
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
 -- Only G.8 tournament tickets receive the shorter speech-friendly threshold.
 -- A client cannot set this flag; it is derived from a server-owned ticket.
 select exists (
   select 1 from public.g8_tournament_attempts ta
   join public.g8_tournament_entries te on te.id=ta.entry_id
   join public.g8_tournaments t on t.id=te.tournament_id
   where ta.g4_attempt_id=p_attempt
     and te.user_id=v_uid
     and t.world_index=v_attempt.world_index
     and ta.challenge_index=v_attempt.challenge_index
     and v_attempt.started_at>=t.starts_at
     and v_attempt.started_at<t.ends_at
 ) into v_is_g8;
 if v_is_g8 then v_min_duration:=interval '400 milliseconds';end if;
 if now()-v_attempt.started_at<v_min_duration then
  insert into public.g4_security_flags(user_id,reason) values(v_uid,'rapid_finish');
  return jsonb_build_object('accepted',false,'duplicate',false,'xp',0,'reason','rapid_finish','minimum_ms',extract(epoch from v_min_duration)*1000);
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
