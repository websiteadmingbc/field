-- Harden Storage policies for job photo paths: {project_id}/{filename}
-- split_part is more reliable than storage.foldername casting on some projects.

drop policy if exists "job_photos_select" on storage.objects;
drop policy if exists "job_photos_insert" on storage.objects;
drop policy if exists "job_photos_delete" on storage.objects;

create or replace function public.storage_project_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

create policy "job_photos_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'job-photos'
    and public.can_view_project(public.storage_project_id(name))
  );

create policy "job_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and (
      public.is_admin_or_pm()
      or public.is_assigned_to_project(public.storage_project_id(name))
    )
  );

create policy "job_photos_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'job-photos'
    and (
      public.is_admin_or_pm()
      or public.is_assigned_to_project(public.storage_project_id(name))
    )
  )
  with check (
    bucket_id = 'job-photos'
    and (
      public.is_admin_or_pm()
      or public.is_assigned_to_project(public.storage_project_id(name))
    )
  );

create policy "job_photos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'job-photos'
    and (
      public.is_admin_or_pm()
      or public.is_assigned_to_project(public.storage_project_id(name))
      or owner = auth.uid()
    )
  );
