-- Personnel Directory (Phase 2) — idempotent
-- skills, certifications, project assignments, licenses, insurance, documents, activity log

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.verification_status as enum (
    'verified',
    'pending_verification',
    'expiring_soon',
    'expired',
    'missing_information',
    'not_applicable'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assignment_status as enum (
    'active',
    'completed',
    'planned',
    'removed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_category as enum (
    'employment_agreement',
    'independent_contractor_agreement',
    'subcontractor_agreement',
    'w9',
    'license',
    'insurance_certificate',
    'certification',
    'safety_training',
    'onboarding_document',
    'other'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Skills
-- ---------------------------------------------------------------------------

create table if not exists public.personnel_skills (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  primary_trade text not null default '',
  secondary_trades text[] not null default '{}',
  specialties text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personnel_skills_personnel_idx on public.personnel_skills (personnel_id);

drop trigger if exists personnel_skills_set_updated_at on public.personnel_skills;
create trigger personnel_skills_set_updated_at
  before update on public.personnel_skills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Certifications
-- ---------------------------------------------------------------------------

create table if not exists public.personnel_certifications (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  name text not null,
  issuer text not null default '',
  certification_number text not null default '',
  issue_date date,
  expiration_date date,
  verification_status public.verification_status not null default 'pending_verification',
  verification_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personnel_certifications_personnel_idx
  on public.personnel_certifications (personnel_id);
create index if not exists personnel_certifications_expiration_idx
  on public.personnel_certifications (expiration_date);

drop trigger if exists personnel_certifications_set_updated_at on public.personnel_certifications;
create trigger personnel_certifications_set_updated_at
  before update on public.personnel_certifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Project assignments
-- ---------------------------------------------------------------------------

create table if not exists public.personnel_project_assignments (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  assigned_role text not null default '',
  start_date date,
  end_date date,
  status public.assignment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (personnel_id, project_id)
);

create index if not exists personnel_project_assignments_personnel_idx
  on public.personnel_project_assignments (personnel_id);
create index if not exists personnel_project_assignments_project_idx
  on public.personnel_project_assignments (project_id);

drop trigger if exists personnel_project_assignments_set_updated_at on public.personnel_project_assignments;
create trigger personnel_project_assignments_set_updated_at
  before update on public.personnel_project_assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Licenses
-- ---------------------------------------------------------------------------

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid references public.personnel (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  license_type text not null,
  license_number text not null default '',
  issuing_authority text not null default '',
  license_classification text not null default '',
  issue_date date,
  expiration_date date,
  verification_date date,
  verification_status public.verification_status not null default 'pending_verification',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint licenses_owner_check check (
    personnel_id is not null or company_id is not null
  )
);

create index if not exists licenses_personnel_idx on public.licenses (personnel_id);
create index if not exists licenses_company_idx on public.licenses (company_id);
create index if not exists licenses_expiration_idx on public.licenses (expiration_date);

drop trigger if exists licenses_set_updated_at on public.licenses;
create trigger licenses_set_updated_at
  before update on public.licenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Insurance policies
-- ---------------------------------------------------------------------------

create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid references public.personnel (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  insurance_type text not null,
  provider text not null default '',
  policy_reference text not null default '',
  coverage_expiration date,
  workers_comp_status text not null default '',
  verification_status public.verification_status not null default 'pending_verification',
  verification_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_owner_check check (
    personnel_id is not null or company_id is not null
  )
);

create index if not exists insurance_personnel_idx on public.insurance_policies (personnel_id);
create index if not exists insurance_company_idx on public.insurance_policies (company_id);
create index if not exists insurance_expiration_idx on public.insurance_policies (coverage_expiration);

drop trigger if exists insurance_policies_set_updated_at on public.insurance_policies;
create trigger insurance_policies_set_updated_at
  before update on public.insurance_policies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create table if not exists public.personnel_documents (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid references public.personnel (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  document_name text not null,
  category public.document_category not null default 'other',
  storage_path text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  upload_date timestamptz not null default now(),
  issue_date date,
  expiration_date date,
  verification_status public.verification_status not null default 'pending_verification',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_owner_check check (
    personnel_id is not null or company_id is not null
  )
);

create index if not exists personnel_documents_personnel_idx on public.personnel_documents (personnel_id);
create index if not exists personnel_documents_company_idx on public.personnel_documents (company_id);
create index if not exists personnel_documents_category_idx on public.personnel_documents (category);

drop trigger if exists personnel_documents_set_updated_at on public.personnel_documents;
create trigger personnel_documents_set_updated_at
  before update on public.personnel_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------

create table if not exists public.personnel_activity_log (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid references public.personnel (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null default 'personnel',
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists personnel_activity_log_personnel_idx
  on public.personnel_activity_log (personnel_id, created_at desc);
create index if not exists personnel_activity_log_created_idx
  on public.personnel_activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Private storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'personnel-documents',
  'personnel-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

drop policy if exists "personnel_docs_select_managers" on storage.objects;
create policy "personnel_docs_select_managers"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'personnel-documents'
    and public.can_manage_users()
  );

drop policy if exists "personnel_docs_insert_managers" on storage.objects;
create policy "personnel_docs_insert_managers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'personnel-documents'
    and public.can_manage_users()
  );

drop policy if exists "personnel_docs_update_managers" on storage.objects;
create policy "personnel_docs_update_managers"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'personnel-documents'
    and public.can_manage_users()
  )
  with check (
    bucket_id = 'personnel-documents'
    and public.can_manage_users()
  );

drop policy if exists "personnel_docs_delete_managers" on storage.objects;
create policy "personnel_docs_delete_managers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'personnel-documents'
    and public.can_manage_users()
  );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.personnel_skills enable row level security;
alter table public.personnel_certifications enable row level security;
alter table public.personnel_project_assignments enable row level security;
alter table public.licenses enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.personnel_documents enable row level security;
alter table public.personnel_activity_log enable row level security;

drop policy if exists "personnel_skills_select_console" on public.personnel_skills;
create policy "personnel_skills_select_console"
  on public.personnel_skills for select to authenticated
  using (public.can_access_admin_console());
drop policy if exists "personnel_skills_write_managers" on public.personnel_skills;
create policy "personnel_skills_write_managers"
  on public.personnel_skills for all to authenticated
  using (public.can_manage_users()) with check (public.can_manage_users());

drop policy if exists "personnel_certs_select_console" on public.personnel_certifications;
create policy "personnel_certs_select_console"
  on public.personnel_certifications for select to authenticated
  using (public.can_access_admin_console());
drop policy if exists "personnel_certs_write_managers" on public.personnel_certifications;
create policy "personnel_certs_write_managers"
  on public.personnel_certifications for all to authenticated
  using (public.can_manage_users()) with check (public.can_manage_users());

drop policy if exists "personnel_proj_assign_select_console" on public.personnel_project_assignments;
create policy "personnel_proj_assign_select_console"
  on public.personnel_project_assignments for select to authenticated
  using (public.can_access_admin_console());
drop policy if exists "personnel_proj_assign_write_managers" on public.personnel_project_assignments;
create policy "personnel_proj_assign_write_managers"
  on public.personnel_project_assignments for all to authenticated
  using (public.can_manage_users()) with check (public.can_manage_users());

drop policy if exists "licenses_managers" on public.licenses;
create policy "licenses_managers"
  on public.licenses for all to authenticated
  using (public.can_manage_users()) with check (public.can_manage_users());

drop policy if exists "insurance_managers" on public.insurance_policies;
create policy "insurance_managers"
  on public.insurance_policies for all to authenticated
  using (public.can_manage_users()) with check (public.can_manage_users());

drop policy if exists "personnel_documents_managers" on public.personnel_documents;
create policy "personnel_documents_managers"
  on public.personnel_documents for all to authenticated
  using (public.can_manage_users()) with check (public.can_manage_users());

drop policy if exists "personnel_activity_select_console" on public.personnel_activity_log;
create policy "personnel_activity_select_console"
  on public.personnel_activity_log for select to authenticated
  using (public.can_access_admin_console());
drop policy if exists "personnel_activity_insert_managers" on public.personnel_activity_log;
create policy "personnel_activity_insert_managers"
  on public.personnel_activity_log for insert to authenticated
  with check (public.can_manage_users());
