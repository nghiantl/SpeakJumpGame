-- Phase G.2: per-user cloud progress, explicit writes, optimistic concurrency.
create table if not exists public.player_cloud_saves (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 100000),
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now()
);
alter table public.player_cloud_saves enable row level security;
revoke all on public.player_cloud_saves from anon, authenticated;
grant select on public.player_cloud_saves to authenticated;
drop policy if exists "owner read cloud save" on public.player_cloud_saves;
create policy "owner read cloud save" on public.player_cloud_saves
 for select to authenticated using ((select auth.uid()) = user_id);
create or replace function public.write_player_cloud_save(p_payload jsonb, p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_revision bigint;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) >= 100000
 then raise exception 'Invalid save payload'; end if;
 if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision'; end if;
 if p_expected_revision = 0 then
   insert into public.player_cloud_saves(user_id,payload,revision) values(v_uid,p_payload,1)
   on conflict do nothing returning revision into v_revision;
 else
   update public.player_cloud_saves
   set payload=p_payload,revision=revision+1,updated_at=now()
   where user_id=v_uid and revision=p_expected_revision
   returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'Cloud save conflict; reload before writing' using errcode='40001'; end if;
 return v_revision;
end $$;
revoke all on function public.write_player_cloud_save(jsonb,bigint) from public, anon;
grant execute on function public.write_player_cloud_save(jsonb,bigint) to authenticated;
-- Note: client-side scores and saves are not authoritative/anti-cheat verified.
