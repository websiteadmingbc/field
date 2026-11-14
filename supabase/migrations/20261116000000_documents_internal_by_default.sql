-- Internal-first Document Library (California need-to-know)
-- New uploads default Internal; Crew/Shared are explicit opt-in only.

-- 1) Category defaults: all Internal
update public.document_categories
set default_visibility = 'internal';

-- Categories that may appear in field UI once visibility is Crew/Shared
update public.document_categories
set field_visible = true
where scope = 'job'
  and code in ('DWG', 'SPEC', 'PERMIT', 'LOG', 'SAFETY', 'PHOTO');

-- Categories that should not appear in field lists even if mis-tagged
update public.document_categories
set field_visible = false
where scope = 'job'
  and code in ('CONTRACT', 'EST', 'RFI', 'SUB', 'CO', 'INV', 'CLOSE', 'CORR');

update public.document_categories
set field_visible = false
where scope = 'company';

-- 2) Lock down existing files: Crew/Shared → Internal (office must re-share for field)
update public.documents
set visibility = 'internal'
where visibility in ('crew', 'shared');

-- Named shares kept; they apply again when visibility is set back to Shared.
