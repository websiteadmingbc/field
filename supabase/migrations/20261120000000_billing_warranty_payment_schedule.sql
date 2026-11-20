-- Warranty clause + payment schedule on estimates and invoices

alter table public.estimates
  add column if not exists warranty_clause text not null default '',
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb;

alter table public.invoices
  add column if not exists warranty_clause text not null default '',
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb;
