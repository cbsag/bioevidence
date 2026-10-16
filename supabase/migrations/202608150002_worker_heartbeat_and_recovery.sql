create table if not exists public.qa_workers (
  worker_id text primary key,
  status text not null default 'online',
  current_job_id uuid references public.qa_jobs(id) on delete set null,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qa_workers_status_check
    check (status in ('online', 'busy', 'error', 'offline'))
);

drop trigger if exists qa_workers_set_updated_at on public.qa_workers;
create trigger qa_workers_set_updated_at
before update on public.qa_workers
for each row execute function public.set_updated_at();

alter table public.qa_workers enable row level security;

drop policy if exists qa_workers_select_authenticated on public.qa_workers;
create policy qa_workers_select_authenticated
on public.qa_workers
for select
to authenticated
using (true);

grant select on public.qa_workers to authenticated;

create or replace function public.claim_next_qa_job(worker_identity text default null)
returns setof public.qa_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.qa_jobs
  set status = 'pending',
      worker_id = null,
      started_at = null,
      error_message = null,
      updated_at = now()
  where status = 'running'
    and coalesce(last_event_at, started_at, updated_at) < now() - interval '10 minutes';

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
