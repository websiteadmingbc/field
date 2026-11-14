-- Britton Field Document Library — Phase 1 (MVP)
-- Core tables, job-level categories, private storage, RLS, soft-delete (Trash).
-- Phase 2+: revisions UI, archive lifecycle, purge/legal hold, ZIP export, field offline, shares.
-- Documents live on each job (no global library / sidebar item).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.document_scope as enum ('job', 'company');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_visibility as enum ('internal', 'crew', 'shared');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_status as enum ('active', 'archived', 'trashed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_scan_status as enum ('pending', 'available', 'quarantined', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_event_action as enum (
    'upload',
    'view',
    'download',
    'export',
    'archive',
    'restore',
    'trash',
    'purge',
    'hold_on',
    'hold_off',
    'metadata_edit'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Categories (fixed taxonomy)
-- ---------------------------------------------------------------------------

create table if not exists public.document_categories (
  id uuid primary key default gen_random_uuid(),
  scope public.document_scope not null default 'job',
  name text not null,
  code text not null,
  default_visibility public.document_visibility not null default 'internal',
  versioned boolean not null default false,
  retention_years int not null default 10,
  field_visible boolean not null default false,
  sort_order int not null default 100,
  unique (scope, code)
);

create index if not exists document_categories_scope_idx
  on public.document_categories (scope, sort_order);

insert into public.document_categories
  (scope, name, code, default_visibility, versioned, retention_years, field_visible, sort_order)
values
  ('job', 'Contracts & Agreements', 'CONTRACT', 'internal', true, 10, false, 10),
  ('job', 'Estimates & Proposals', 'EST', 'internal', true, 10, false, 20),
  ('job', 'Drawings / Plans', 'DWG', 'crew', true, 10, true, 30),
  ('job', 'Specifications', 'SPEC', 'crew', true, 10, true, 40),
  ('job', 'Permits & Inspections', 'PERMIT', 'crew', false, 10, true, 50),
  ('job', 'RFIs', 'RFI', 'internal', false, 10, false, 60),
  ('job', 'Submittals', 'SUB', 'internal', true, 10, false, 70),
  ('job', 'Change Orders', 'CO', 'internal', true, 10, false, 80),
  ('job', 'Daily Logs & Reports', 'LOG', 'crew', false, 10, true, 90),
  ('job', 'Safety', 'SAFETY', 'crew', false, 5, true, 100),
  ('job', 'Invoices & Lien Waivers', 'INV', 'internal', false, 7, false, 110),
  ('job', 'Photos & Media', 'PHOTO', 'crew', false, 10, true, 120),
  ('job', 'Closeout & Warranties', 'CLOSE', 'internal', true, 10, false, 130),
  ('job', 'Correspondence', 'CORR', 'internal', false, 10, false, 140)
on conflict (scope, code) do nothing;

-- Company-level categories reserved for a later phase (no global library yet)
insert into public.document_categories
  (scope, name, code, default_visibility, versioned, retention_years, field_visible, sort_order)
values
  ('company', 'Insurance & COIs', 'COI', 'internal', false, 10, false, 10),
  ('company', 'Licenses & Certifications', 'LIC', 'internal', false, 10, false, 20),
  ('company', 'Templates', 'TMPL', 'internal', true, 10, false, 30),
  ('company', 'Policies & HR', 'HR', 'internal', false, 10, false, 40),
  ('company', 'Vendor & Subcontractor files', 'VENDOR', 'internal', false, 10, false, 50)
on conflict (scope, code) do nothing;

-- ---------------------------------------------------------------------------
-- Documents + versions
-- ---------------------------------------------------------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.projects (id) on delete cascade,
  category_id uuid not null references public.document_categories (id),
  title text not null,
  doc_number text not null default '',
  visibility public.document_visibility not null default 'internal',
  status public.document_status not null default 'active',
  current_version_id uuid,
  legal_hold boolean not null default false,
  retain_until date,
  tags text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  trashed_at timestamptz,
  constraint documents_job_or_company check (job_id is not null)
);

create index if not exists documents_job_idx on public.documents (job_id);
create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_category_idx on public.documents (category_id);
create index if not exists documents_created_at_idx on public.documents (created_at desc);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  rev_label text not null default 'R0',
  storage_path text not null,
  file_name_original text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  sha256 text,
  scan_status public.document_scan_status not null default 'pending',
  page_count int,
  extracted_text text,
  superseded_at timestamptz,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists document_versions_document_idx
  on public.document_versions (document_id, uploaded_at desc);

alter table public.documents
  drop constraint if exists documents_current_version_fk;
alter table public.documents
  add constraint documents_current_version_fk
  foreign key (current_version_id) references public.document_versions (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- Shares / links / events / exports (Phase 3–4 ready; Phase 1 uses events)
-- ---------------------------------------------------------------------------

create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  expires_at timestamptz,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, personnel_id)
);

create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (document_id, entity_type, entity_id)
);

create table if not exists public.document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version_id uuid references public.document_versions (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action public.document_event_action not null,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists document_events_document_idx
  on public.document_events (document_id, created_at desc);
create index if not exists document_events_actor_idx
  on public.document_events (actor_id, created_at desc);

-- Append-only: no update/delete policies granted below

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles (id) on delete set null,
  scope jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  storage_path text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_job_documents(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_admin_console()
    or public.is_admin_or_pm()
    or (
      public.is_assigned_to_project(p_job_id)
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.active = true
          and p.app_role in (
            'project_manager',
            'project_coordinator',
            'project_engineer',
            'site_supervisor',
            'crew_lead'
          )
      )
    );
$$;

create or replace function public.can_view_job_document(p_job_id uuid, p_visibility public.document_visibility)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when public.can_access_admin_console() or public.is_admin_or_pm() then true
      when not public.is_assigned_to_project(p_job_id) then false
      when p_visibility = 'internal' then public.can_manage_job_documents(p_job_id)
      when p_visibility in ('crew', 'shared') then true
      else false
    end;
$$;

create or replace function public.set_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_documents_updated_at();

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  104857600, -- 100 MB per object (batch cap enforced in app)
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    'video/mp4',
    'application/acad',
    'application/x-acad',
    'application/dwg',
    'image/vnd.dwg',
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;

-- Previews / exports buckets reserved for later phases
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('document-previews', 'document-previews', false, 52428800),
  ('exports', 'exports', false, 524288000)
on conflict (id) do nothing;

-- Storage path: jobs/{job_id}/{document_id}/{version_id}/{filename}
drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and public.can_view_project((split_part(name, '/', 2))::uuid)
  );

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and public.can_manage_job_documents((split_part(name, '/', 2))::uuid)
  );

drop policy if exists "documents_storage_update" on storage.objects;
create policy "documents_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and public.can_manage_job_documents((split_part(name, '/', 2))::uuid)
  )
  with check (
    bucket_id = 'documents'
    and public.can_manage_job_documents((split_part(name, '/', 2))::uuid)
  );

drop policy if exists "documents_storage_delete" on storage.objects;
create policy "documents_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and public.can_manage_job_documents((split_part(name, '/', 2))::uuid)
  );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.document_categories enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_shares enable row level security;
alter table public.document_links enable row level security;
alter table public.document_events enable row level security;
alter table public.export_jobs enable row level security;

drop policy if exists "document_categories_select" on public.document_categories;
create policy "document_categories_select"
  on public.document_categories for select
  to authenticated
  using (true);

drop policy if exists "documents_select" on public.documents;
create policy "documents_select"
  on public.documents for select
  to authenticated
  using (
    job_id is not null
    and public.can_view_job_document(job_id, visibility)
    and (
      status = 'active'
      or public.can_manage_job_documents(job_id)
    )
  );

drop policy if exists "documents_insert" on public.documents;
create policy "documents_insert"
  on public.documents for insert
  to authenticated
  with check (
    job_id is not null
    and public.can_manage_job_documents(job_id)
  );

drop policy if exists "documents_update" on public.documents;
create policy "documents_update"
  on public.documents for update
  to authenticated
  using (
    job_id is not null
    and public.can_manage_job_documents(job_id)
  )
  with check (
    job_id is not null
    and public.can_manage_job_documents(job_id)
  );

-- Soft delete only in Phase 1 (status → trashed). No hard DELETE policy for non-owners.
drop policy if exists "documents_delete_owner" on public.documents;
create policy "documents_delete_owner"
  on public.documents for delete
  to authenticated
  using (public.can_manage_users());

drop policy if exists "document_versions_select" on public.document_versions;
create policy "document_versions_select"
  on public.document_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.job_id is not null
        and public.can_view_job_document(d.job_id, d.visibility)
    )
  );

drop policy if exists "document_versions_insert" on public.document_versions;
create policy "document_versions_insert"
  on public.document_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.job_id is not null
        and public.can_manage_job_documents(d.job_id)
    )
  );

drop policy if exists "document_versions_update" on public.document_versions;
create policy "document_versions_update"
  on public.document_versions for update
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.job_id is not null
        and public.can_manage_job_documents(d.job_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.job_id is not null
        and public.can_manage_job_documents(d.job_id)
    )
  );

drop policy if exists "document_events_select" on public.document_events;
create policy "document_events_select"
  on public.document_events for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.job_id is not null
        and public.can_manage_job_documents(d.job_id)
    )
  );

drop policy if exists "document_events_insert" on public.document_events;
create policy "document_events_insert"
  on public.document_events for insert
  to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.job_id is not null
        and public.can_view_job_document(d.job_id, d.visibility)
    )
  );

-- Shares / links / exports: managers only until Phase 3–4
drop policy if exists "document_shares_managers" on public.document_shares;
create policy "document_shares_managers"
  on public.document_shares for all
  to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());

drop policy if exists "document_links_managers" on public.document_links;
create policy "document_links_managers"
  on public.document_links for all
  to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());

drop policy if exists "export_jobs_own" on public.export_jobs;
create policy "export_jobs_own"
  on public.export_jobs for all
  to authenticated
  using (requested_by = auth.uid() or public.can_access_admin_console())
  with check (requested_by = auth.uid() or public.can_access_admin_console());
