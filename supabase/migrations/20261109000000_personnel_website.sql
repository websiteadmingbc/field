-- Personnel → public website directory cards
-- website category, publish confirm fields, public view, avatar bucket, seed roster

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.website_personnel_category as enum (
    'leadership',
    'field',
    'office'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Columns on personnel
-- ---------------------------------------------------------------------------

alter table public.personnel
  add column if not exists website_category public.website_personnel_category,
  add column if not exists website_published boolean not null default false,
  add column if not exists website_published_at timestamptz,
  add column if not exists website_published_by uuid references public.profiles (id) on delete set null,
  add column if not exists website_slug text,
  add column if not exists website_sort_order int not null default 0;

create unique index if not exists personnel_website_slug_uidx
  on public.personnel (website_slug)
  where website_slug is not null and website_slug <> '';

create index if not exists personnel_website_published_idx
  on public.personnel (website_published)
  where website_published = true;

create index if not exists personnel_website_category_idx
  on public.personnel (website_category);

-- ---------------------------------------------------------------------------
-- Public read view (security definer / owner rights — anon never hits raw personnel RLS)
-- ---------------------------------------------------------------------------

drop view if exists public.personnel_website;

create view public.personnel_website
with (security_invoker = false)
as
select
  p.id,
  p.first_name,
  p.last_name,
  p.preferred_name,
  p.middle_name,
  p.job_title,
  p.personnel_code,
  p.website_category,
  p.avatar_path,
  p.website_slug,
  p.website_sort_order
from public.personnel p
where p.website_published = true
  and p.status = 'active'
  and p.archived_at is null
  and p.website_category is not null;

revoke all on public.personnel_website from public;
grant select on public.personnel_website to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public avatar bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'personnel-avatars',
  'personnel-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "personnel_avatars_public_read" on storage.objects;
create policy "personnel_avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'personnel-avatars');

drop policy if exists "personnel_avatars_insert_managers" on storage.objects;
create policy "personnel_avatars_insert_managers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'personnel-avatars'
    and public.can_manage_users()
  );

drop policy if exists "personnel_avatars_update_managers" on storage.objects;
create policy "personnel_avatars_update_managers"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'personnel-avatars'
    and public.can_manage_users()
  )
  with check (
    bucket_id = 'personnel-avatars'
    and public.can_manage_users()
  );

drop policy if exists "personnel_avatars_delete_managers" on storage.objects;
create policy "personnel_avatars_delete_managers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'personnel-avatars'
    and public.can_manage_users()
  );

-- ---------------------------------------------------------------------------
-- Seed / upsert current static website roster (Paul, Eli, Dylan)
-- Prefer matching existing rows by work_email or name; otherwise insert.
-- ---------------------------------------------------------------------------

-- Great Britton Construction internal company (for affiliations)
insert into public.companies (name, company_type, relationship_status)
select 'Great Britton Construction', 'internal', 'active'
where not exists (
  select 1 from public.companies c
  where lower(c.name) = 'great britton construction'
);

do $$
declare
  gbc_id uuid;
  paul_id uuid;
  eli_id uuid;
  dylan_id uuid;
begin
  select id into gbc_id
  from public.companies
  where lower(name) = 'great britton construction'
  order by created_at
  limit 1;

  -- Paul A. Alcantar
  select id into paul_id
  from public.personnel
  where website_slug = 'paula'
     or lower(work_email) in ('paul@greatbrittongc.com', 'paula@greatbrittongc.com')
     or (lower(first_name) = 'paul' and lower(last_name) like 'alcantar%')
  order by created_at
  limit 1;

  if paul_id is null then
    insert into public.personnel (
      personnel_code, first_name, middle_name, last_name, preferred_name,
      job_title, classification, status,
      website_category, website_published, website_published_at, website_slug,
      website_sort_order, avatar_path
    ) values (
      'GBC-0001', 'Paul', 'A', 'Alcantar', 'Paul',
      'Project Manager', 'project_manager', 'active',
      'leadership', true, now(), 'paula',
      10, 'https://greatbrittongc.com/assets/crew/paul-alcantar.jpg'
    )
    returning id into paul_id;
  else
    update public.personnel set
      first_name = coalesce(nullif(first_name, ''), 'Paul'),
      middle_name = case when middle_name = '' then 'A' else middle_name end,
      last_name = coalesce(nullif(last_name, ''), 'Alcantar'),
      preferred_name = case when preferred_name = '' then 'Paul' else preferred_name end,
      job_title = case when job_title = '' then 'Project Manager' else job_title end,
      website_category = 'leadership',
      website_published = true,
      website_published_at = coalesce(website_published_at, now()),
      website_slug = 'paula',
      website_sort_order = 10,
      avatar_path = coalesce(
        nullif(avatar_path, ''),
        'https://greatbrittongc.com/assets/crew/paul-alcantar.jpg'
      ),
      status = 'active',
      archived_at = null
    where id = paul_id;
  end if;

  -- Eli M.
  select id into eli_id
  from public.personnel
  where website_slug = 'elim'
     or lower(work_email) like 'eli%@greatbrittongc.com'
     or (lower(first_name) = 'eli' and lower(last_name) like 'm%')
  order by created_at
  limit 1;

  if eli_id is null then
    insert into public.personnel (
      personnel_code, first_name, last_name, preferred_name,
      job_title, classification, status,
      website_category, website_published, website_published_at, website_slug,
      website_sort_order
    ) values (
      'GBC-0002', 'Eli', 'M', 'Eli',
      'Operations Manager', 'administrator', 'active',
      'leadership', true, now(), 'elim',
      20
    )
    returning id into eli_id;
  else
    update public.personnel set
      preferred_name = case when preferred_name = '' then 'Eli' else preferred_name end,
      job_title = case when job_title = '' then 'Operations Manager' else job_title end,
      website_category = 'leadership',
      website_published = true,
      website_published_at = coalesce(website_published_at, now()),
      website_slug = 'elim',
      website_sort_order = 20,
      status = 'active',
      archived_at = null
    where id = eli_id;
  end if;

  -- Dylan S. Simpson
  select id into dylan_id
  from public.personnel
  where website_slug = 'dylans'
     or lower(work_email) like 'dylan%@greatbrittongc.com'
     or lower(work_email) like '%dylan.simpson%'
     or (lower(first_name) = 'dylan' and lower(last_name) like 'simpson%')
  order by created_at
  limit 1;

  if dylan_id is null then
    insert into public.personnel (
      personnel_code, first_name, middle_name, last_name, preferred_name,
      job_title, classification, status,
      website_category, website_published, website_published_at, website_slug,
      website_sort_order, avatar_path
    ) values (
      'GBC-0104', 'Dylan', 'S', 'Simpson', 'Dylan',
      'Director of Growth & Client Relations', 'administrator', 'active',
      'office', true, now(), 'dylans',
      30, 'https://greatbrittongc.com/assets/crew/dylan-simpson.jpg'
    )
    returning id into dylan_id;
  else
    update public.personnel set
      first_name = coalesce(nullif(first_name, ''), 'Dylan'),
      middle_name = case when middle_name = '' then 'S' else middle_name end,
      last_name = coalesce(nullif(last_name, ''), 'Simpson'),
      preferred_name = case when preferred_name = '' then 'Dylan' else preferred_name end,
      job_title = case
        when job_title = '' then 'Director of Growth & Client Relations'
        else job_title
      end,
      website_category = 'office',
      website_published = true,
      website_published_at = coalesce(website_published_at, now()),
      website_slug = 'dylans',
      website_sort_order = 30,
      avatar_path = coalesce(
        nullif(avatar_path, ''),
        'https://greatbrittongc.com/assets/crew/dylan-simpson.jpg'
      ),
      status = 'active',
      archived_at = null
    where id = dylan_id;
  end if;

  if gbc_id is not null then
    insert into public.personnel_company_affiliations (personnel_id, company_id, is_primary)
    select paul_id, gbc_id, true
    where paul_id is not null
      and not exists (
        select 1 from public.personnel_company_affiliations a
        where a.personnel_id = paul_id and a.company_id = gbc_id
      );

    insert into public.personnel_company_affiliations (personnel_id, company_id, is_primary)
    select eli_id, gbc_id, true
    where eli_id is not null
      and not exists (
        select 1 from public.personnel_company_affiliations a
        where a.personnel_id = eli_id and a.company_id = gbc_id
      );

    insert into public.personnel_company_affiliations (personnel_id, company_id, is_primary)
    select dylan_id, gbc_id, true
    where dylan_id is not null
      and not exists (
        select 1 from public.personnel_company_affiliations a
        where a.personnel_id = dylan_id and a.company_id = gbc_id
      );
  end if;
end $$;
