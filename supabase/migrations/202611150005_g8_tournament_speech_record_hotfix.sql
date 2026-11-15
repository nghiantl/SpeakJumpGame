-- Hotfix G.8: avoid PL/pgSQL record variable/SQL alias collision.
-- Safe CREATE OR REPLACE only; no table changes, existing registrations preserved.
create or replace function public.g8_start_tournament_attempt(p_entry uuid,p_challenge integer)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_entry record;
  v_attempt uuid;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select te.id,te.user_id,te.status,t.world_index,t.challenge_count,t.ends_at,t.starts_at
  into v_entry
  from public.g8_tournament_entries te
  join public.g8_tournaments t on t.id=te.tournament_id
  where te.id=p_entry
  for update of te;
  if not found then raise exception 'Attempt unavailable';end if;
  if v_entry.user_id<>v_user or v_entry.status<>'registered'
    or now()<v_entry.starts_at or now()>=v_entry.ends_at
    or p_challenge is null or p_challenge<0 or p_challenge>=v_entry.challenge_count
  then raise exception 'Attempt unavailable';end if;
  if exists(select 1 from public.g8_tournament_attempts a
    where a.entry_id=p_entry and a.challenge_index=p_challenge)
  then raise exception 'Already attempted';end if;
  v_attempt:=public.g4_start_attempt(v_entry.world_index,p_challenge);
  if v_attempt is null then raise exception 'G.4 attempt limit reached';end if;
  insert into public.g8_tournament_attempts(entry_id,challenge_index,g4_attempt_id)
  values(p_entry,p_challenge,v_attempt);
  return v_attempt;
end $$;

create or replace function public.g8_finish_tournament_attempt(p_entry uuid,p_challenge integer,p_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_attempt record;
  v_result jsonb;
  v_accepted boolean;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select ta.*,te.user_id,t.ends_at into v_attempt
  from public.g8_tournament_attempts ta
  join public.g8_tournament_entries te on te.id=ta.entry_id
  join public.g8_tournaments t on t.id=te.tournament_id
  where ta.entry_id=p_entry and ta.challenge_index=p_challenge
  for update of ta;
  if not found then raise exception 'Attempt unavailable';end if;
  if v_attempt.user_id<>v_user or now()>v_attempt.ends_at then
    raise exception 'Attempt unavailable';
  end if;
  if v_attempt.accepted then
    return jsonb_build_object('accepted',true,'duplicate',true);
  end if;
  v_result:=public.g4_finish_attempt(v_attempt.g4_attempt_id,left(coalesce(p_name,'Adventurer'),24));
  v_accepted:=coalesce((v_result->>'accepted')::boolean,false);
  if v_accepted then
    update public.g8_tournament_attempts set accepted=true where id=v_attempt.id;
    update public.g8_tournament_entries set score=least(400,score+100) where id=p_entry;
  end if;
  return jsonb_build_object('accepted',v_accepted,'duplicate',coalesce((v_result->>'duplicate')::boolean,false));
end $$;
