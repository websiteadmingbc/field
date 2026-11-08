-- Start landing page visit log (city-level only; no IP storage)
-- Same Supabase project as field.greatbrittongc.com

create table if not exists public.start_visits (
  id bigint generated always as identity primary key,
  visited_at timestamptz not null default now(),
  city text,
  region text,
  country text,
  path text not null default '/',
  referrer text
);

create index if not exists start_visits_visited_at_idx
  on public.start_visits (visited_at desc);

alter table public.start_visits enable row level security;

drop policy if exists "start_visits_anon_insert" on public.start_visits;
create policy "start_visits_anon_insert"
  on public.start_visits for insert
  to anon, authenticated
  with check (true);

drop policy if exists "start_visits_auth_select" on public.start_visits;
create policy "start_visits_auth_select"
  on public.start_visits for select
  to authenticated
  using (true);

revoke all on table public.start_visits from anon, authenticated;
grant insert on table public.start_visits to anon, authenticated;
grant select on table public.start_visits to authenticated;
grant usage, select on sequence public.start_visits_id_seq to anon, authenticated;
