-- Document Library Phase 3 — search + export support
-- export_jobs / extracted_text already exist from Phase 1.
-- Add trigram-friendly indexes for title/tag/text search when extension is available.

create extension if not exists pg_trgm;

create index if not exists documents_title_trgm_idx
  on public.documents using gin (title gin_trgm_ops);

create index if not exists document_versions_extracted_text_trgm_idx
  on public.document_versions using gin (extracted_text gin_trgm_ops);

-- Storage policies for temporary export ZIPs (7-day retention handled in app / lifecycle rules)
drop policy if exists "exports_storage_own" on storage.objects;
create policy "exports_storage_own"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
