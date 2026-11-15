-- G.8 hotfix: recover tournament registrations from authenticated server state.
-- No existing entry/attempt is modified. No direct table writes are granted.
create or replace function public.g8_my_tournament_entries()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at desc),'[]'::jsonb)
    from (
      select e.id as entry_id,e.tournament_id,e.status,e.score,e.created_at,
             t.starts_at,t.ends_at,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                 'challenge_index',a.challenge_index,
                 'accepted',a.accepted,
                 'started_at',a.created_at
               ) order by a.challenge_index)
               from public.g8_tournament_attempts a where a.entry_id=e.id
             ),'[]'::jsonb) as attempts
      from public.g8_tournament_entries e
      join public.g8_tournaments t on t.id=e.tournament_id
      where e.user_id=auth.uid()
      order by t.starts_at desc
      limit 100
    ) x
  );
end $$;
revoke all on function public.g8_my_tournament_entries() from public,anon,authenticated;
grant execute on function public.g8_my_tournament_entries() to authenticated;
