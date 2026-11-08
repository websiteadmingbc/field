-- Personnel Directory (Phase 1) — idempotent
-- companies, personnel, affiliations, sensitive fields, seed from profiles

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.personnel_classification as enum (
    'employee',
    'independent_contractor',
    'subcontractor',
    'project_manager',
    'sales_representative',
    'administrator',
    'consultant',
    'vendor_contact',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.personnel_status as enum (
    'active',
    'inactive',
    'on_leave',
    'pending_onboarding',
    'suspended',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.company_type as enum (
    'internal',
    'subcontractor',
    'vendor',
    'client',
    'partner',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.company_relationship_status as enum (
    'active',
    'inactive',
    'pending',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.preferred_contact_method as enum (
    'mobile',
    'work_phone',
    'work_email',
    'personal_email',
    'text'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_type public.company_type not null default 'other',
  business_phone text not null default '',
  business_email text not null default '',
  trade_specialty text not null default '',
  relationship_status public.company_relationship_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists companies_name_idx on public.companies (lower(name));
create index if not exists companies_type_idx on public.companies (company_type);
create index if not exists companies_status_idx on public.companies (relationship_status);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Personnel code sequence (GB-00001)
-- ---------------------------------------------------------------------------

create sequence if not exists public.personnel_code_seq start 1;

create or replace function public.next_personnel_code()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('public.personnel_code_seq');
  return 'GB-' || lpad(n::text, 5, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Personnel
-- ---------------------------------------------------------------------------

create table if not exists public.personnel (
  id uuid primary key default gen_random_uuid(),
  personnel_code text not null unique default public.next_personnel_code(),
  first_name text not null,
  middle_name text not null default '',
  last_name text not null,
  preferred_name text not null default '',
  avatar_path text,
  work_email text not null default '',
  mobile_phone text not null default '',
  work_phone text not null default '',
  preferred_contact_method public.preferred_contact_method,
  business_address text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  classification public.personnel_classification not null default 'employee',
  job_title text not null default '',
  department text not null default '',
  primary_role text not null default '',
  additional_roles text[] not null default '{}',
  reports_to uuid references public.personnel (id) on delete set null,
  status public.personnel_status not null default 'active',
  start_date date,
  end_date date,
  work_arrangement text not null default '',
  primary_work_location text not null default '',
  service_territory text not null default '',
  availability text not null default '',
  linked_user_id uuid unique references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists personnel_name_idx on public.personnel (lower(last_name), lower(first_name));
create index if not exists personnel_code_idx on public.personnel (personnel_code);
create index if not exists personnel_work_email_idx on public.personnel (lower(work_email));
create index if not exists personnel_mobile_idx on public.personnel (mobile_phone);
create index if not exists personnel_classification_idx on public.personnel (classification);
create index if not exists personnel_status_idx on public.personnel (status);
create index if not exists personnel_job_title_idx on public.personnel (lower(job_title));
create index if not exists personnel_linked_user_idx on public.personnel (linked_user_id);
create index if not exists personnel_start_date_idx on public.personnel (start_date);

drop trigger if exists personnel_set_updated_at on public.personnel;
create trigger personnel_set_updated_at
  before update on public.personnel
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Company affiliations
-- ---------------------------------------------------------------------------

create table if not exists public.personnel_company_affiliations (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  is_primary boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (personnel_id, company_id)
);

create index if not exists personnel_affiliations_personnel_idx
  on public.personnel_company_affiliations (personnel_id);
create index if not exists personnel_affiliations_company_idx
  on public.personnel_company_affiliations (company_id);

create unique index if not exists personnel_affiliations_one_primary
  on public.personnel_company_affiliations (personnel_id)
  where is_primary;

-- ---------------------------------------------------------------------------
-- Sensitive fields (tighter RLS)
-- ---------------------------------------------------------------------------

create table if not exists public.personnel_sensitive (
  personnel_id uuid primary key references public.personnel (id) on delete cascade,
  personal_email text not null default '',
  emergency_contact_name text not null default '',
  emergency_contact_relationship text not null default '',
  emergency_contact_phone text not null default '',
  internal_notes text not null default '',
  updated_at timestamptz not null default now()
);

drop trigger if exists personnel_sensitive_set_updated_at on public.personnel_sensitive;
create trigger personnel_sensitive_set_updated_at
  before update on public.personnel_sensitive
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.personnel enable row level security;
alter table public.personnel_company_affiliations enable row level security;
alter table public.personnel_sensitive enable row level security;

drop policy if exists "companies_select_console" on public.companies;
create policy "companies_select_console"
  on public.companies for select
  to authenticated
  using (public.can_access_admin_console());

drop policy if exists "companies_write_managers" on public.companies;
create policy "companies_write_managers"
  on public.companies for all
  to authenticated
  using (public.can_manage_users())
  with check (public.can_manage_users());

drop policy if exists "personnel_select_console" on public.personnel;
create policy "personnel_select_console"
  on public.personnel for select
  to authenticated
  using (public.can_access_admin_console());

drop policy if exists "personnel_write_managers" on public.personnel;
create policy "personnel_write_managers"
  on public.personnel for all
  to authenticated
  using (public.can_manage_users())
  with check (public.can_manage_users());

drop policy if exists "affiliations_select_console" on public.personnel_company_affiliations;
create policy "affiliations_select_console"
  on public.personnel_company_affiliations for select
  to authenticated
  using (public.can_access_admin_console());

drop policy if exists "affiliations_write_managers" on public.personnel_company_affiliations;
create policy "affiliations_write_managers"
  on public.personnel_company_affiliations for all
  to authenticated
  using (public.can_manage_users())
  with check (public.can_manage_users());

drop policy if exists "personnel_sensitive_managers" on public.personnel_sensitive;
create policy "personnel_sensitive_managers"
  on public.personnel_sensitive for all
  to authenticated
  using (public.can_manage_users())
  with check (public.can_manage_users());

-- ---------------------------------------------------------------------------
-- Seed from existing profiles
-- ---------------------------------------------------------------------------

insert into public.personnel (
  first_name,
  last_name,
  work_email,
  mobile_phone,
  job_title,
  classification,
  status,
  linked_user_id,
  primary_role
)
select
  coalesce(nullif(split_part(p.full_name, ' ', 1), ''), p.full_name),
  case
    when position(' ' in p.full_name) > 0
      then trim(substring(p.full_name from position(' ' in p.full_name) + 1))
    else ''
  end,
  coalesce(p.email, ''),
  coalesce(p.phone, ''),
  coalesce(p.title, ''),
  case
    when p.app_role in ('admin', 'general_manager', 'operations_manager', 'office_manager', 'bookkeeper')
      then 'administrator'::public.personnel_classification
    when p.app_role = 'project_manager' then 'project_manager'::public.personnel_classification
    when p.app_role = 'subcontractor' then 'subcontractor'::public.personnel_classification
    when p.app_role = 'client' then 'vendor_contact'::public.personnel_classification
    else 'employee'::public.personnel_classification
  end,
  case
    when p.active then 'active'::public.personnel_status
    else 'inactive'::public.personnel_status
  end,
  p.id,
  coalesce(p.title, '')
from public.profiles p
where not exists (
  select 1 from public.personnel pe where pe.linked_user_id = p.id
);

select setval(
  'public.personnel_code_seq',
  greatest(
    (select coalesce(max(nullif(regexp_replace(personnel_code, '\D', '', 'g'), '')::bigint), 0)
     from public.personnel),
    1
  )
);
