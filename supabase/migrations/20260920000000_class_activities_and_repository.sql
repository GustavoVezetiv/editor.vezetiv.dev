-- Consolidates class-scoped activities and remote attempt state.
-- Generated manually because the Supabase CLI is not available in this workspace.

alter table public.attempts
  add column if not exists active_document_id text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists score_reached_at timestamptz;

create table public.class_activities (
  id text primary key,
  class_id text not null references public.classes(id) on delete cascade,
  activity_id text not null references public.activities(id) on delete cascade,
  is_featured boolean not null default false,
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, activity_id)
);

insert into public.class_activities (id, class_id, activity_id, is_featured, available_from, available_until)
select 'class-activity:' || c.id || ':' || a.id, c.id, a.id, false, a.available_from, a.available_until
from public.classes c cross join public.activities a
on conflict (class_id, activity_id) do nothing;

create unique index if not exists class_activities_one_featured_per_class
  on public.class_activities (class_id) where is_featured;
create index if not exists class_activities_class_availability_idx
  on public.class_activities (class_id, available_from, available_until);
create index if not exists attempts_class_ranking_idx
  on public.attempts (activity_id, student_id, current_score desc, score_reached_at asc);

alter table public.class_activities enable row level security;
revoke all on public.class_activities from anon;
grant select, insert, update, delete on public.class_activities to authenticated;

create schema if not exists private;
create or replace function private.current_student_class_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.class_id from public.students s
  where s.auth_user_id = (select auth.uid())
  limit 1
$$;
revoke all on function private.current_student_class_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_student_class_id() to authenticated;

drop policy if exists "students read published activities" on public.activities;

create policy "students read assigned activities" on public.activities for select to authenticated
using (
  status = 'published' and exists (
    select 1 from public.class_activities ca
    join public.students s on s.class_id = ca.class_id
    where ca.activity_id = activities.id
      and s.auth_user_id = (select auth.uid())
      and (ca.available_from is null or ca.available_from <= now())
      and (ca.available_until is null or ca.available_until >= now())
  )
);

create policy "students read class activity assignments" on public.class_activities for select to authenticated
using (exists (
  select 1 from public.students s
  where s.class_id = class_activities.class_id and s.auth_user_id = (select auth.uid())
));

create policy "students read classmates" on public.students for select to authenticated
using (students.class_id = private.current_student_class_id());

create policy "students read class ranking attempts" on public.attempts for select to authenticated
using (exists (
  select 1 from public.students owner
  join public.class_activities ca on ca.class_id = owner.class_id and ca.activity_id = attempts.activity_id
  where owner.id = attempts.student_id and owner.class_id = private.current_student_class_id()
));

create policy "teachers access own classes" on public.classes for all to authenticated
using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "teachers access class students" on public.students for all to authenticated
using (exists (select 1 from public.classes c where c.id = students.class_id and c.teacher_id = (select auth.uid())))
with check (exists (select 1 from public.classes c where c.id = students.class_id and c.teacher_id = (select auth.uid())));
create policy "teachers create activities" on public.activities for insert to authenticated
with check (exists (select 1 from public.classes c where c.teacher_id = (select auth.uid())));
create policy "teachers read assigned activities" on public.activities for select to authenticated
using (exists (select 1 from public.class_activities ca join public.classes c on c.id = ca.class_id where ca.activity_id = activities.id and c.teacher_id = (select auth.uid())));
create policy "teachers update assigned activities" on public.activities for update to authenticated
using (exists (select 1 from public.class_activities ca join public.classes c on c.id = ca.class_id where ca.activity_id = activities.id and c.teacher_id = (select auth.uid())))
with check (exists (select 1 from public.class_activities ca join public.classes c on c.id = ca.class_id where ca.activity_id = activities.id and c.teacher_id = (select auth.uid())));
create policy "teachers access class assignments" on public.class_activities for all to authenticated
using (exists (select 1 from public.classes c where c.id = class_activities.class_id and c.teacher_id = (select auth.uid())))
with check (exists (select 1 from public.classes c where c.id = class_activities.class_id and c.teacher_id = (select auth.uid())));
create policy "teachers access class attempts" on public.attempts for all to authenticated
using (exists (select 1 from public.students s join public.classes c on c.id = s.class_id where s.id = attempts.student_id and c.teacher_id = (select auth.uid())))
with check (exists (select 1 from public.students s join public.classes c on c.id = s.class_id where s.id = attempts.student_id and c.teacher_id = (select auth.uid())));
create policy "teachers access class documents" on public.documents for select to authenticated
using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id join public.classes c on c.id = s.class_id where a.id = documents.attempt_id and c.teacher_id = (select auth.uid())));
create policy "teachers access class verification runs" on public.verification_runs for select to authenticated
using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id join public.classes c on c.id = s.class_id where a.id = verification_runs.attempt_id and c.teacher_id = (select auth.uid())));
create policy "teachers access class events" on public.activity_events for select to authenticated
using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id join public.classes c on c.id = s.class_id where a.id = activity_events.attempt_id and c.teacher_id = (select auth.uid())));
