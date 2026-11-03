-- Britton Field — initial schema, roles, RLS, storage
-- Run in Supabase SQL Editor (or via supabase db push)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum (
  'admin',
  'project_manager',
  'site_supervisor',
  'crew'
);

create type public.job_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'on_hold'
);

create type public.log_status as enum (
  'draft',
  'submitted'
);

create type public.photo_category as enum (
  'before',
  'progress',
  'after',
  'issue'
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  title text,
  phone text,
  email text not null,
  app_role public.app_role not null default 'crew',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_app_role_idx on public.profiles (app_role);
create index profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- Projects (jobs)
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique,
  name text not null,
  client text not null default '',
  description text not null default '',
  job_type text not null default 'General Construction',
  status public.job_status not null default 'scheduled',
  scheduled_date date,
  start_time text not null default '07:00',
  address text not null default '',
  city text not null default '',
  state text not null default 'CA',
  zip text not null default '',
  parking_instructions text not null default '',
  entrance_info text not null default '',
  access_instructions text not null default '',
  scope_of_work text not null default '',
  important_instructions text not null default '',
  required_materials text not null default '',
  safety_considerations text not null default '',
  site_notes text not null default '',
  lat double precision,
  lng double precision,
  checklist jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_status_idx on public.projects (status);
create index projects_scheduled_date_idx on public.projects (scheduled_date);

-- ---------------------------------------------------------------------------
-- Site contacts (customer / GC / inspector — not app users)
-- ---------------------------------------------------------------------------

create table public.site_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  full_name text not null,
  contact_role text not null default '',
  phone text not null default '',
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index site_contacts_project_idx on public.site_contacts (project_id);

-- ---------------------------------------------------------------------------
-- Crew assignments (who is on which job)
-- ---------------------------------------------------------------------------

create table public.project_assignments (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assignment_role text not null default 'crew',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_assignments_user_idx on public.project_assignments (user_id);

-- ---------------------------------------------------------------------------
-- Site notices / updates
-- ---------------------------------------------------------------------------

create table public.project_notices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  body text not null,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index project_notices_project_idx on public.project_notices (project_id);

-- ---------------------------------------------------------------------------
-- Daily logs
-- ---------------------------------------------------------------------------

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null default (timezone('America/Los_Angeles', now()))::date,
  work_completed text not null default '',
  materials_used text not null default '',
  issues text not null default '',
  notes_for_next text not null default '',
  status public.log_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index daily_logs_project_idx on public.daily_logs (project_id);
create index daily_logs_author_idx on public.daily_logs (author_id);

-- ---------------------------------------------------------------------------
-- Photos (metadata; files in Storage bucket job-photos)
-- ---------------------------------------------------------------------------

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  category public.photo_category not null default 'progress',
  caption text not null default '',
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index photos_project_idx on public.photos (project_id);
create index photos_author_idx on public.photos (author_id);

-- ---------------------------------------------------------------------------
-- Activity feed (optional audit trail)
-- ---------------------------------------------------------------------------

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  activity_type text not null,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create index activity_project_idx on public.activity (project_id);
create index activity_created_idx on public.activity (created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so RLS can call them safely)
-- ---------------------------------------------------------------------------

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select app_role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_admin_or_pm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and active = true
      and app_role in ('admin', 'project_manager')
  );
$$;

create or replace function public.is_assigned_to_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_assignments
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_pm()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.app_role = 'site_supervisor'
        and public.is_assigned_to_project(p_project_id)
    );
$$;

create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_pm()
    or public.is_assigned_to_project(p_project_id);
$$;

-- Auto-create profile when auth user is created (invite flow).
-- Admin should then set app_role / title in the dashboard.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, app_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'app_role')::public.app_role, 'crew')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.site_contacts enable row level security;
alter table public.project_assignments enable row level security;
alter table public.project_notices enable row level security;
alter table public.daily_logs enable row level security;
alter table public.photos enable row level security;
alter table public.activity enable row level security;

-- Profiles: everyone signed in can view directory; users update self; admin manages all
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (active = true or id = auth.uid());

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Projects
create policy "projects_select"
  on public.projects for select
  to authenticated
  using (public.can_view_project(id));

create policy "projects_update_status_managers"
  on public.projects for update
  to authenticated
  using (public.can_manage_project(id))
  with check (public.can_manage_project(id));

-- Insert/delete projects: admin via service role / dashboard (bypass RLS) in v1.
-- Also allow admin JWT if they use the app later.
create policy "projects_admin_insert"
  on public.projects for insert
  to authenticated
  with check (public.current_app_role() = 'admin');

create policy "projects_admin_delete"
  on public.projects for delete
  to authenticated
  using (public.current_app_role() = 'admin');

-- Site contacts: visible with project; write via admin dashboard (or admin JWT)
create policy "site_contacts_select"
  on public.site_contacts for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "site_contacts_admin_write"
  on public.site_contacts for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Assignments
create policy "assignments_select"
  on public.project_assignments for select
  to authenticated
  using (
    public.is_admin_or_pm()
    or user_id = auth.uid()
    or public.is_assigned_to_project(project_id)
  );

create policy "assignments_admin_write"
  on public.project_assignments for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Notices: managers post; assignees read
create policy "notices_select"
  on public.project_notices for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "notices_insert_managers"
  on public.project_notices for insert
  to authenticated
  with check (
    public.can_manage_project(project_id)
    and author_id = auth.uid()
  );

create policy "notices_delete_managers"
  on public.project_notices for delete
  to authenticated
  using (public.can_manage_project(project_id));

-- Daily logs
create policy "logs_select"
  on public.daily_logs for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "logs_insert_assigned"
  on public.daily_logs for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin_or_pm()
      or public.is_assigned_to_project(project_id)
    )
  );

create policy "logs_update"
  on public.daily_logs for update
  to authenticated
  using (
    public.is_admin_or_pm()
    or (
      public.current_app_role() = 'site_supervisor'
      and public.is_assigned_to_project(project_id)
    )
    or author_id = auth.uid()
  )
  with check (
    public.is_admin_or_pm()
    or (
      public.current_app_role() = 'site_supervisor'
      and public.is_assigned_to_project(project_id)
    )
    or author_id = auth.uid()
  );

create policy "logs_delete"
  on public.daily_logs for delete
  to authenticated
  using (
    public.is_admin_or_pm()
    or (
      public.current_app_role() = 'site_supervisor'
      and public.is_assigned_to_project(project_id)
    )
    or author_id = auth.uid()
  );

-- Photos
create policy "photos_select"
  on public.photos for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "photos_insert_assigned"
  on public.photos for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin_or_pm()
      or public.is_assigned_to_project(project_id)
    )
  );

create policy "photos_delete"
  on public.photos for delete
  to authenticated
  using (
    public.is_admin_or_pm()
    or (
      public.current_app_role() = 'site_supervisor'
      and public.is_assigned_to_project(project_id)
    )
    or author_id = auth.uid()
  );

-- Activity
create policy "activity_select"
  on public.activity for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "activity_insert"
  on public.activity for insert
  to authenticated
  with check (
    public.can_view_project(project_id)
    and (author_id is null or author_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage: job-photos bucket
-- Path convention: {project_id}/{photo_id}.{ext}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "job_photos_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'job-photos'
    and public.can_view_project((storage.foldername(name))[1]::uuid)
  );

create policy "job_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and (
      public.is_admin_or_pm()
      or public.is_assigned_to_project((storage.foldername(name))[1]::uuid)
    )
  );

create policy "job_photos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'job-photos'
    and (
      public.is_admin_or_pm()
      or public.is_assigned_to_project((storage.foldername(name))[1]::uuid)
      or owner = auth.uid()
    )
  );
