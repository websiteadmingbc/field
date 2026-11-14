-- Operations Manager: same user-management rights as Owner/Admin and General Manager
-- (invite, personnel writes, profile admin, sensitive fields, etc.)

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
      and app_role in ('admin', 'general_manager', 'operations_manager')
  );
$$;
