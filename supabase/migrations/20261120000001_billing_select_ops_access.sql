-- Ensure ops-console roles can always read billing docs (not only project assignees).

drop policy if exists "estimates_select" on public.estimates;
create policy "estimates_select"
  on public.estimates for select to authenticated
  using (public.can_view_project(project_id) or public.can_access_admin_console());

drop policy if exists "estimate_line_items_select" on public.estimate_line_items;
create policy "estimate_line_items_select"
  on public.estimate_line_items for select to authenticated
  using (
    public.can_access_admin_console()
    or exists (
      select 1 from public.estimates e
      where e.id = estimate_id and public.can_view_project(e.project_id)
    )
  );

drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select"
  on public.invoices for select to authenticated
  using (public.can_view_project(project_id) or public.can_access_admin_console());

drop policy if exists "invoice_line_items_select" on public.invoice_line_items;
create policy "invoice_line_items_select"
  on public.invoice_line_items for select to authenticated
  using (
    public.can_access_admin_console()
    or exists (
      select 1 from public.invoices i
      where i.id = invoice_id and public.can_view_project(i.project_id)
    )
  );

drop policy if exists "invoice_payments_select" on public.invoice_payments;
create policy "invoice_payments_select"
  on public.invoice_payments for select to authenticated
  using (
    public.can_access_admin_console()
    or exists (
      select 1 from public.invoices i
      where i.id = invoice_id and public.can_view_project(i.project_id)
    )
  );
