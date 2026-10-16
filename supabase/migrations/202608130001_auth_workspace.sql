create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.access_status as enum ('pending', 'approved', 'blocked');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  organization text,
  role text,
  use_case text,
  access_status public.access_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text,
  organization text,
  role text,
  use_case text,
  status public.access_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  topic_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.saved_questions(id) on delete set null,
  system_id text,
  answer_text text not null,
  evidence_pmids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists access_requests_set_updated_at on public.access_requests;
create trigger access_requests_set_updated_at
before update on public.access_requests
for each row execute function public.set_updated_at();

drop trigger if exists saved_questions_set_updated_at on public.saved_questions;
create trigger saved_questions_set_updated_at
before update on public.saved_questions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'role'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        role = coalesce(public.profiles.role, excluded.role),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.saved_questions enable row level security;
alter table public.saved_answers enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists access_requests_insert_public on public.access_requests;
create policy access_requests_insert_public
on public.access_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists access_requests_select_own on public.access_requests;
create policy access_requests_select_own
on public.access_requests
for select
to authenticated
using (
  user_id = (select auth.uid())
  or email = (select auth.jwt() ->> 'email')
);

drop policy if exists saved_questions_select_own on public.saved_questions;
create policy saved_questions_select_own
on public.saved_questions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists saved_questions_insert_own on public.saved_questions;
create policy saved_questions_insert_own
on public.saved_questions
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists saved_questions_update_own on public.saved_questions;
create policy saved_questions_update_own
on public.saved_questions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists saved_questions_delete_own on public.saved_questions;
create policy saved_questions_delete_own
on public.saved_questions
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists saved_answers_select_own on public.saved_answers;
create policy saved_answers_select_own
on public.saved_answers
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists saved_answers_insert_own on public.saved_answers;
create policy saved_answers_insert_own
on public.saved_answers
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists saved_answers_update_own on public.saved_answers;
create policy saved_answers_update_own
on public.saved_answers
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists saved_answers_delete_own on public.saved_answers;
create policy saved_answers_delete_own
on public.saved_answers
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists usage_events_select_own on public.usage_events;
create policy usage_events_select_own
on public.usage_events
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own
on public.usage_events
for insert
to authenticated
with check (user_id = (select auth.uid()));

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant insert on public.access_requests to anon, authenticated;
grant select on public.access_requests to authenticated;
grant select, insert, update, delete on public.saved_questions to authenticated;
grant select, insert, update, delete on public.saved_answers to authenticated;
grant select, insert on public.usage_events to authenticated;
