-- Document Library Phase 4 — field pins support helpers, submittal upload, shares, links

alter table public.document_links
  add column if not exists label text not null default '';

-- Current user's personnel row (for share checks)
create or replace function public.current_personnel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.personnel
  where linked_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_document_share(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.document_shares s
    where s.document_id = p_document_id
      and s.personnel_id = public.current_personnel_id()
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

create or replace function public.can_upload_job_submittal(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_assigned_to_project(p_job_id)
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.app_role = 'subcontractor'
    );
$$;

drop function if exists public.can_view_job_document(uuid, public.document_visibility);
drop function if exists public.can_view_job_document(uuid, public.document_visibility, uuid);

-- Shared docs: named shares only (not all assigned crew). Crew visibility unchanged.
create function public.can_view_job_document(
  p_job_id uuid,
  p_visibility public.document_visibility,
  p_document_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when public.can_access_admin_console() or public.is_admin_or_pm() then true
      when public.can_manage_job_documents(p_job_id) then true
      when p_visibility = 'internal' then false
      when p_visibility = 'crew' then public.is_assigned_to_project(p_job_id)
      when p_visibility = 'shared' then
        (p_document_id is not null and public.has_document_share(p_document_id))
      else false
    end;
$$;

-- Subs may only create Submittals (category code SUB)
create or replace function public.documents_guard_submittal_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cat_code text;
begin
  if public.can_manage_job_documents(new.job_id) then
    return new;
  end if;
  if public.can_upload_job_submittal(new.job_id) then
    select code into cat_code from public.document_categories where id = new.category_id;
    if cat_code is distinct from 'SUB' then
      raise exception 'Subcontractors may only upload Submittals';
    end if;
    if new.visibility is distinct from 'shared' and new.visibility is distinct from 'internal' then
      new.visibility := 'shared';
    end if;
    return new;
  end if;
  raise exception 'Not allowed to create documents on this job';
end;
$$;

drop trigger if exists documents_guard_submittal_upload on public.documents;
create trigger documents_guard_submittal_upload
  before insert on public.documents
  for each row execute function public.documents_guard_submittal_upload();

drop policy if exists "documents_select" on public.documents;
create policy "documents_select"
  on public.documents for select
  to authenticated
  using (
    job_id is not null
    and public.can_view_job_document(job_id, visibility, id)
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
    and (
      public.can_manage_job_documents(job_id)
      or public.can_upload_job_submittal(job_id)
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
        and (
          public.can_manage_job_documents(d.job_id)
          or public.can_upload_job_submittal(d.job_id)
        )
    )
  );

drop policy if exists "document_versions_select" on public.document_versions;
create policy "document_versions_select"
  on public.document_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.job_id is not null
        and public.can_view_job_document(d.job_id, d.visibility, d.id)
    )
  );

-- Storage: assigned viewers + managers; subs can upload on assigned jobs
drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.can_view_project((split_part(name, '/', 2))::uuid)
      or public.can_manage_job_documents((split_part(name, '/', 2))::uuid)
    )
  );

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (
      public.can_manage_job_documents((split_part(name, '/', 2))::uuid)
      or public.can_upload_job_submittal((split_part(name, '/', 2))::uuid)
    )
  );

-- Shares: managers administer; shared person can read their own rows
drop policy if exists "document_shares_managers" on public.document_shares;
create policy "document_shares_managers"
  on public.document_shares for all
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

drop policy if exists "document_shares_self_select" on public.document_shares;
create policy "document_shares_self_select"
  on public.document_shares for select
  to authenticated
  using (personnel_id = public.current_personnel_id());

-- Links: managers write; anyone who can view the doc can read links
drop policy if exists "document_links_managers" on public.document_links;
create policy "document_links_managers"
  on public.document_links for all
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

drop policy if exists "document_links_select_viewers" on public.document_links;
create policy "document_links_select_viewers"
  on public.document_links for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.job_id is not null
        and public.can_view_job_document(d.job_id, d.visibility, d.id)
    )
  );
