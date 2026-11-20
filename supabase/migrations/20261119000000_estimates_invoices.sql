-- Estimates & Invoices (Joist-style, job-scoped). PDF export is client-side; no email in v1.

create type public.estimate_status as enum (
  'draft',
  'sent',
  'approved',
  'declined',
  'void'
);

create type public.invoice_status as enum (
  'draft',
  'sent',
  'partial',
  'paid',
  'void'
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  estimate_number text not null unique,
  title text not null default '',
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',
  status public.estimate_status not null default 'draft',
  notes text not null default '',
  tax_rate_pct numeric(6, 3) not null default 0,
  valid_until date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index estimates_project_idx on public.estimates (project_id);
create index estimates_status_idx on public.estimates (status);

create table public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  sort_order integer not null default 0,
  description text not null default '',
  quantity numeric(12, 3) not null default 1,
  unit text not null default 'ea',
  unit_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index estimate_line_items_estimate_idx on public.estimate_line_items (estimate_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  invoice_number text not null unique,
  title text not null default '',
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',
  status public.invoice_status not null default 'draft',
  notes text not null default '',
  tax_rate_pct numeric(6, 3) not null default 0,
  due_date date,
  amount_paid numeric(12, 2) not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_project_idx on public.invoices (project_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_estimate_idx on public.invoices (estimate_id);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  sort_order integer not null default 0,
  description text not null default '',
  quantity numeric(12, 3) not null default 1,
  unit text not null default 'ea',
  unit_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index invoice_line_items_invoice_idx on public.invoice_line_items (invoice_id);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(12, 2) not null,
  paid_on date not null default (timezone('America/Los_Angeles', now()))::date,
  method text not null default 'other',
  note text not null default '',
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id);

drop trigger if exists estimates_set_updated_at on public.estimates;
create trigger estimates_set_updated_at
  before update on public.estimates
  for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.estimates enable row level security;
alter table public.estimate_line_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_payments enable row level security;

-- Ops console roles manage billing; anyone who can view the project can read (for future field views).
create policy "estimates_select"
  on public.estimates for select to authenticated
  using (public.can_view_project(project_id));

create policy "estimates_write"
  on public.estimates for all to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());

create policy "estimate_line_items_select"
  on public.estimate_line_items for select to authenticated
  using (
    exists (
      select 1 from public.estimates e
      where e.id = estimate_id and public.can_view_project(e.project_id)
    )
  );

create policy "estimate_line_items_write"
  on public.estimate_line_items for all to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());

create policy "invoices_select"
  on public.invoices for select to authenticated
  using (public.can_view_project(project_id));

create policy "invoices_write"
  on public.invoices for all to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());

create policy "invoice_line_items_select"
  on public.invoice_line_items for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and public.can_view_project(i.project_id)
    )
  );

create policy "invoice_line_items_write"
  on public.invoice_line_items for all to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());

create policy "invoice_payments_select"
  on public.invoice_payments for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and public.can_view_project(i.project_id)
    )
  );

create policy "invoice_payments_write"
  on public.invoice_payments for all to authenticated
  using (public.can_access_admin_console())
  with check (public.can_access_admin_console());
