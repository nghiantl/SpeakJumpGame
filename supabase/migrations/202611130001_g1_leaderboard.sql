-- G.1: public leaderboard, authenticated anonymous accounts, owner-only RPC writes.
create table if not exists public.player_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer' check (char_length(display_name) between 1 and 24),
  xp bigint not null default 0 check (xp between 0 and 999999999),
  worlds_completed integer not null default 0 check (worlds_completed between 0 and 4),
  best_combo integer not null default 0 check (best_combo between 0 and 100000),
  updated_at timestamptz not null default now()
);
alter table public.player_scores enable row level security;
revoke all on public.player_scores from anon, authenticated;
grant select on public.player_scores to anon, authenticated;
create policy "leaderboard read" on public.player_scores for select to anon, authenticated using (true);
-- No INSERT/UPDATE/DELETE table policy: authenticated clients must use the owner-scoped RPC.
create or replace function public.submit_player_score(p_name text, p_xp bigint, p_worlds integer, p_combo integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 24 or
     p_xp is null or p_xp not between 0 and 999999999 or
     p_worlds is null or p_worlds not between 0 and 4 or
     p_combo is null or p_combo not between 0 and 100000
  then raise exception 'Invalid leaderboard data'; end if;
  insert into public.player_scores (user_id,display_name,xp,worlds_completed,best_combo)
  values (uid, trim(p_name),p_xp,p_worlds,p_combo)
  on conflict (user_id) do update
    set display_name=excluded.display_name,
        xp=greatest(player_scores.xp,excluded.xp),
        worlds_completed=greatest(player_scores.worlds_completed,excluded.worlds_completed),
        best_combo=greatest(player_scores.best_combo,excluded.best_combo),
        updated_at=now();
end; $$;
revoke all on function public.submit_player_score(text,bigint,integer,integer) from public, anon;
grant execute on function public.submit_player_score(text,bigint,integer,integer) to authenticated;
create index if not exists player_scores_rank_idx on public.player_scores (xp desc,worlds_completed desc,best_combo desc);
-- Caveat: these values originate in the client; anti-cheat requires server-validated gameplay events.
