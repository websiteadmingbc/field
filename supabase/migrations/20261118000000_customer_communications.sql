-- Customer communications: job-scoped conversation capture (Operations create; visibility-gated read)

create type public.communication_message_type as enum ('text', 'email', 'phone', 'other');
create type public.communication_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.communication_visibility as enum ('all', 'supervisor', 'operations');

create table public.customer_communications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  recipient_name text not null,
  sender_name text not null,
  communicated_on date not null default (timezone('America/Los_Angeles', now()))::date,
  communicated_at time,
  device_type text not null default '',
  message_type public.communication_message_type not null default 'phone',
  priority public.communication_priority not null default 'normal',
  visibility public.communication_visibility not null default 'all',
  body text not null,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_communications_project_idx
  on public.customer_communications (project_id);

create index customer_communications_communicated_on_idx
  on public.customer_communications (communicated_on desc);

drop trigger if exists customer_communications_set_updated_at on public.customer_communications;
create trigger customer_communications_set_updated_at
  before update on public.customer_communications
  for each row execute function public.set_updated_at();

-- Who may see a row given its visibility setting (role-only; project access checked in policy)
create or replace function public.can_view_communication_visibility(
  p_visibility public.communication_visibility
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_visibility
    when 'all' then true
    when 'operations' then public.can_access_admin_console()
    when 'supervisor' then exists (
      select 1 from public.profiles
      where id = auth.uid()
        and active = true
        and app_role in (
          'admin',
          'general_manager',
          'operations_manager',
          'estimator',
          'office_manager',
          'bookkeeper',
          'project_manager',
          'project_coordinator',
          'project_engineer',
          'site_supervisor',
          'safety_officer',
          'crew_lead'
        )
    )
    else false
  end;
$$;

alter table public.customer_communications enable row level security;

create policy "customer_communications_select"
  on public.customer_communications for select
  to authenticated
  using (
    public.can_view_project(project_id)
    and public.can_view_communication_visibility(visibility)
  );

create policy "customer_communications_insert"
  on public.customer_communications for insert
  to authenticated
  with check (
    public.can_access_admin_console()
    and author_id = auth.uid()
  );

create policy "customer_communications_update"
  on public.customer_communications for update
  to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());

create policy "customer_communications_delete"
  on public.customer_communications for delete
  to authenticated
  using (public.can_access_admin_console());
