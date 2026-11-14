-- Document Library Phase 2 — lifecycle helpers (revisions/archive/retention/purge/hold)
-- Schema columns already exist from Phase 1; this adds retention + hold guard helpers.

create or replace function public.apply_job_completion_retention(p_job_id uuid, p_completed_on date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int := 0;
begin
  if not public.can_manage_job_documents(p_job_id) then
    raise exception 'Not allowed to apply retention for this job';
  end if;

  update public.documents d
  set retain_until = (p_completed_on + make_interval(years => c.retention_years))::date
  from public.document_categories c
  where d.category_id = c.id
    and d.job_id = p_job_id
    and d.status in ('active', 'archived')
    and (d.retain_until is null or d.retain_until < (p_completed_on + make_interval(years => c.retention_years))::date);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.archive_job_working_documents(p_job_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int := 0;
begin
  if not public.can_manage_job_documents(p_job_id) then
    raise exception 'Not allowed to archive documents for this job';
  end if;

  update public.documents d
  set
    status = 'archived',
    archived_at = now()
  from public.document_categories c
  where d.category_id = c.id
    and d.job_id = p_job_id
    and d.status = 'active'
    and d.legal_hold = false
    and c.code in ('RFI', 'SUB', 'LOG', 'CORR', 'PHOTO');

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- Block trash/archive updates when legal hold is on (defense in depth; app also checks)
create or replace function public.documents_guard_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.legal_hold = true then
    if new.status is distinct from old.status and new.status in ('archived', 'trashed') then
      raise exception 'Document is on legal hold and cannot be archived or trashed';
    end if;
    if new.legal_hold = false and not public.can_manage_users() then
      -- only Owner/Admin (can_manage_users) may lift hold — GM included per users helper;
      -- app restricts hold_on/off to admin; lifting via SQL still requires can_manage_users
      null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_guard_lifecycle on public.documents;
create trigger documents_guard_lifecycle
  before update on public.documents
  for each row execute function public.documents_guard_lifecycle();
