alter table public.qa_sources
  add column if not exists source_type text not null default 'pubmed',
  add column if not exists source_id text;

update public.qa_sources
set source_id = pmid
where source_id is null;

alter table public.qa_sources
  alter column source_id set not null,
  alter column pmid drop not null;

alter table public.qa_sources
  drop constraint if exists qa_sources_job_id_pmid_key;

create unique index if not exists qa_sources_job_source_key
on public.qa_sources(job_id, source_type, source_id);

alter table public.qa_sources
  drop constraint if exists qa_sources_source_type_check;

alter table public.qa_sources
  add constraint qa_sources_source_type_check
  check (source_type in ('pubmed', 'europe_pmc', 'clinical_trials'));
