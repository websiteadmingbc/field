-- Personnel IDs: GBC-001, GBC-002, … (3-digit numeric, GBC prefix)

create or replace function public.next_personnel_code()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('public.personnel_code_seq');
  return 'GBC-' || lpad(n::text, 3, '0');
end;
$$;

-- Reformat existing codes: keep the numeric value, switch to GBC-NNN
update public.personnel
set personnel_code = 'GBC-' || lpad(
  nullif(regexp_replace(personnel_code, '\D', '', 'g'), '')::bigint::text,
  3,
  '0'
)
where personnel_code is not null
  and nullif(regexp_replace(personnel_code, '\D', '', 'g'), '') is not null;

select setval(
  'public.personnel_code_seq',
  greatest(
    (select coalesce(max(nullif(regexp_replace(personnel_code, '\D', '', 'g'), '')::bigint), 0)
     from public.personnel),
    1
  )
);
