do $$
begin
  create type public.qa_job_status as enum (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.qa_event_status as enum (
    'queued',
    'running',
    'completed',
    'failed',
    'info'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.qa_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  system_id text not null default 'bioevidence-live-v1',
  status public.qa_job_status not null default 'pending',
  input jsonb not null default '{}'::jsonb,
  answer_text text,
  answer_citations jsonb not null default '[]'::jsonb,
  error_message text,
  worker_id text,
  started_at timestamptz,
  completed_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qa_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.qa_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence integer not null,
  stage text not null,
  title text not null,
  status public.qa_event_status not null default 'running',
  detail text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, sequence)
);

create table if not exists public.qa_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.qa_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pmid text not null,
  title text,
  snippet text,
  journal text,
  publication_year text,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, pmid)
);

drop trigger if exists qa_jobs_set_updated_at on public.qa_jobs;
create trigger qa_jobs_set_updated_at
before update on public.qa_jobs
for each row execute function public.set_updated_at();

create index if not exists qa_jobs_user_created_idx
on public.qa_jobs(user_id, created_at desc);

create index if not exists qa_jobs_status_created_idx
on public.qa_jobs(status, created_at asc);

create index if not exists qa_events_job_sequence_idx
on public.qa_events(job_id, sequence asc);

create index if not exists qa_sources_job_created_idx
on public.qa_sources(job_id, created_at asc);

create or replace function public.claim_next_qa_job(worker_identity text default null)
returns setof public.qa_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.qa_jobs
      set status = 'running',
          started_at = coalesce(started_at, now()),
          last_event_at = now(),
          worker_id = worker_identity,
          updated_at = now()
    where id = (
      select pending.id
      from public.qa_jobs as pending
      where pending.status = 'pending'
      order by pending.created_at asc
      for update skip locked
      limit 1
    )
    returning public.qa_jobs.*;
end;
$$;

alter table public.qa_jobs enable row level security;
alter table public.qa_events enable row level security;
alter table public.qa_sources enable row level security;

drop policy if exists qa_jobs_select_own on public.qa_jobs;
create policy qa_jobs_select_own
on public.qa_jobs
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists qa_events_select_own on public.qa_events;
create policy qa_events_select_own
on public.qa_events
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists qa_sources_select_own on public.qa_sources;
create policy qa_sources_select_own
on public.qa_sources
for select
to authenticated
using (user_id = (select auth.uid()));

grant select on public.qa_jobs to authenticated;
grant select on public.qa_events to authenticated;
grant select on public.qa_sources to authenticated;
grant execute on function public.claim_next_qa_job(text) to service_role;

alter table public.qa_jobs replica identity full;
alter table public.qa_events replica identity full;
alter table public.qa_sources replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.qa_jobs;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.qa_events;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.qa_sources;
exception
  when duplicate_object then null;
end $$;
