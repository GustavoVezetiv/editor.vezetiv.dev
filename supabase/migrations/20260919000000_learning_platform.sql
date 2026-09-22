create table public.classes (
  id text primary key,
  name text not null,
  code text not null unique,
  teacher_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.students (
  id text primary key,
  class_id text not null references public.classes(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id),
  code text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (class_id, code)
);

create table public.activities (
  id text primary key,
  slug text not null unique,
  title text not null,
  description text not null,
  config jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.attempts (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  activity_id text not null references public.activities(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  current_score integer not null default 0,
  status text not null default 'in-progress' check (status in ('not-started', 'in-progress', 'completed'))
);

create unique index attempts_one_open_per_activity on public.attempts (student_id, activity_id)
  where status in ('not-started', 'in-progress');

create table public.documents (
  id text primary key,
  attempt_id text not null references public.attempts(id) on delete cascade,
  name text not null,
  content_json jsonb not null,
  preset text not null check (preset in ('academic-abnt', 'normal')),
  updated_at timestamptz not null default now()
);

create table public.verification_runs (
  id text primary key,
  attempt_id text not null references public.attempts(id) on delete cascade,
  document_id text not null references public.documents(id) on delete cascade,
  score integer not null,
  results_json jsonb not null,
  created_at timestamptz not null default now()
);

create table public.activity_events (
  id text primary key,
  attempt_id text not null references public.attempts(id) on delete cascade,
  document_id text references public.documents(id) on delete cascade,
  type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.activities enable row level security;
alter table public.attempts enable row level security;
alter table public.documents enable row level security;
alter table public.verification_runs enable row level security;
alter table public.activity_events enable row level security;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy "students read own profile" on public.students for select to authenticated using ((select auth.uid()) = auth_user_id);
create policy "students update own profile" on public.students for update to authenticated using ((select auth.uid()) = auth_user_id) with check ((select auth.uid()) = auth_user_id);
create policy "students read enrolled class" on public.classes for select to authenticated using (exists (select 1 from public.students s where s.class_id = classes.id and s.auth_user_id = (select auth.uid())));
create policy "students read published activities" on public.activities for select to authenticated using (status = 'published');
create policy "students read own attempts" on public.attempts for select to authenticated using (exists (select 1 from public.students s where s.id = attempts.student_id and s.auth_user_id = (select auth.uid())));
create policy "students create own attempts" on public.attempts for insert to authenticated with check (exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = (select auth.uid())));
create policy "students update own attempts" on public.attempts for update to authenticated using (exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = (select auth.uid()))) with check (exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = (select auth.uid())));
create policy "students access own documents" on public.documents for all to authenticated using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = documents.attempt_id and s.auth_user_id = (select auth.uid()))) with check (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = documents.attempt_id and s.auth_user_id = (select auth.uid())));
create policy "students access own verification runs" on public.verification_runs for all to authenticated using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = verification_runs.attempt_id and s.auth_user_id = (select auth.uid()))) with check (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = verification_runs.attempt_id and s.auth_user_id = (select auth.uid())));
create policy "students access own events" on public.activity_events for all to authenticated using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = activity_events.attempt_id and s.auth_user_id = (select auth.uid()))) with check (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = activity_events.attempt_id and s.auth_user_id = (select auth.uid())));

-- Teacher policies are intentionally deferred until real teacher identity/roles are implemented.
