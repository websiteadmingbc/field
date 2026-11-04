-- Leadership helpers + RLS updates (runs after enum values are committed)

create or replace function public.can_access_admin_console()
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
      and app_role in ('admin', 'general_manager', 'operations_manager')
  );
$$;

create or replace function public.can_manage_users()
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
      and app_role in ('admin', 'general_manager')
  );
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
      and app_role in (
        'admin',
        'general_manager',
        'operations_manager',
        'project_manager',
        'estimator',
        'office_manager'
      )
  );
$$;

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all
  using (public.can_manage_users())
  with check (public.can_manage_users());

drop policy if exists "profiles_select_admin_console" on public.profiles;
create policy "profiles_select_admin_console"
  on public.profiles for select
  using (public.can_access_admin_console());

-- Project / assignment / contact writes: Owner, GM, Ops (not only legacy admin)
drop policy if exists "projects_admin_insert" on public.projects;
create policy "projects_admin_insert"
  on public.projects for insert
  to authenticated
  with check (public.can_access_admin_console());

drop policy if exists "projects_admin_delete" on public.projects;
create policy "projects_admin_delete"
  on public.projects for delete
  to authenticated
  using (public.can_manage_users());

drop policy if exists "site_contacts_admin_write" on public.site_contacts;
create policy "site_contacts_admin_write"
  on public.site_contacts for all
  to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());

drop policy if exists "assignments_admin_write" on public.project_assignments;
create policy "assignments_admin_write"
  on public.project_assignments for all
  to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());
