-- Authentication, authorization, private student access codes, and class-scoped management.
create extension if not exists pgcrypto with schema extensions;

alter table public.students alter column code drop not null;
alter table public.activities drop column if exists available_from;
alter table public.activities drop column if exists available_until;

create table private.student_access_codes (
  student_id text primary key references public.students(id) on delete cascade,
  access_code_hash text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.student_access_codes from public, anon, authenticated;

create or replace function private.is_anonymous_actor()
returns boolean language sql stable security invoker set search_path = ''
as $$ select coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) $$;

create or replace function private.current_student_id()
returns text language sql stable security definer set search_path = ''
as $$ select s.id from public.students s where s.auth_user_id = (select auth.uid()) limit 1 $$;

create or replace function private.current_student_class_id()
returns text language sql stable security definer set search_path = ''
as $$ select s.class_id from public.students s where s.auth_user_id = (select auth.uid()) limit 1 $$;

create or replace function private.teacher_owns_class(p_class_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.classes c where c.id = p_class_id and c.teacher_id = (select auth.uid())) and not private.is_anonymous_actor() $$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_anonymous_actor(), private.current_student_id(), private.current_student_class_id(), private.teacher_owns_class(text) to authenticated;

create or replace function public.get_current_actor()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_student public.students; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return jsonb_build_object('role', 'anonymous'); end if;
  if not private.is_anonymous_actor() and exists (select 1 from public.classes c where c.teacher_id = v_uid) then
    return jsonb_build_object('role', 'teacher', 'user_id', v_uid);
  end if;
  select * into v_student from public.students s where s.auth_user_id = v_uid limit 1;
  if found then return jsonb_build_object('role', 'student', 'student', jsonb_build_object('id', v_student.id, 'class_id', v_student.class_id, 'code', v_student.code, 'display_name', v_student.display_name, 'created_at', v_student.created_at)); end if;
  return jsonb_build_object('role', 'anonymous');
end $$;

create or replace function public.join_student(p_class_code text, p_access_code text)
returns table (id text, class_id text, code text, display_name text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_student_id text;
begin
  if v_uid is null or not private.is_anonymous_actor() then raise exception 'anonymous student session required'; end if;
  select s.id into v_student_id
  from public.students s join public.classes c on c.id = s.class_id join private.student_access_codes ac on ac.student_id = s.id
  where upper(c.code) = upper(trim(p_class_code)) and ac.access_code_hash = extensions.crypt(upper(trim(p_access_code)), ac.access_code_hash)
  for update of s limit 1;
  if v_student_id is null then raise exception 'invalid class or access code'; end if;
  update public.students s set auth_user_id = v_uid where s.id = v_student_id;
  return query select s.id, s.class_id, s.code, s.display_name, s.created_at from public.students s where s.id = v_student_id;
end $$;

create or replace function public.get_activity_ranking(p_activity_id text)
returns table (display_name text, score integer, reached_score_at timestamptz, position bigint, is_current_student boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select private.current_student_id() student_id, private.current_student_class_id() class_id),
  scored as (
    select a.student_id, s.display_name,
      greatest(a.current_score, coalesce(best_run.score, 0))::integer score,
      case when coalesce(best_run.score, -1) >= a.current_score then best_run.reached_at else coalesce(a.score_reached_at, a.completed_at, a.updated_at, a.started_at) end reached_at
    from public.attempts a join public.students s on s.id = a.student_id join me on me.class_id = s.class_id
    join public.class_activities ca on ca.class_id = s.class_id and ca.activity_id = a.activity_id
    left join lateral (select vr.score, min(vr.created_at) reached_at from public.verification_runs vr where vr.attempt_id = a.id group by vr.score order by vr.score desc limit 1) best_run on true
    where a.activity_id = p_activity_id
  ), best_student as (
    select distinct on (student_id) student_id, display_name, score, reached_at from scored order by student_id, score desc, reached_at asc
  ), ranked as (
    select b.*, row_number() over (order by b.score desc, b.reached_at asc, b.student_id) position from best_student b
  )
  select r.display_name, r.score, r.reached_at, r.position, r.student_id = me.student_id from ranked r cross join me
  where r.position <= 5 or r.student_id = me.student_id order by r.position
$$;

create or replace function private.new_access_code()
returns text language sql volatile security definer set search_path = ''
as $$ select upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4) || '-' || substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4)) $$;

create or replace function public.add_student_to_class(p_class_id text, p_display_name text, p_code text default null)
returns table (id text, class_id text, code text, display_name text, created_at timestamptz, access_code text)
language plpgsql security definer set search_path = '' as $$
declare v_student public.students; v_access text := private.new_access_code();
begin
  if not private.teacher_owns_class(p_class_id) then raise exception 'teacher access required'; end if;
  insert into public.students(id, class_id, code, display_name) values ('student-' || extensions.gen_random_uuid()::text, p_class_id, nullif(trim(p_code), ''), trim(p_display_name)) returning * into v_student;
  insert into private.student_access_codes(student_id, access_code_hash) values (v_student.id, extensions.crypt(v_access, extensions.gen_salt('bf')));
  return query select v_student.id, v_student.class_id, v_student.code, v_student.display_name, v_student.created_at, v_access;
end $$;

create or replace function public.reset_student_access(p_student_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_access text := private.new_access_code(); v_class_id text;
begin
  select s.class_id into v_class_id from public.students s where s.id = p_student_id;
  if not private.teacher_owns_class(v_class_id) then raise exception 'teacher access required'; end if;
  insert into private.student_access_codes(student_id, access_code_hash, updated_at) values (p_student_id, extensions.crypt(v_access, extensions.gen_salt('bf')), now()) on conflict (student_id) do update set access_code_hash = excluded.access_code_hash, updated_at = excluded.updated_at;
  update public.students set auth_user_id = null where students.id = p_student_id;
  return v_access;
end $$;

create or replace function public.create_class_for_teacher(p_name text, p_code text)
returns public.classes language plpgsql security definer set search_path = '' as $$
declare v_class public.classes;
begin
  if private.is_anonymous_actor() or not exists (select 1 from public.classes c where c.teacher_id = (select auth.uid())) then raise exception 'existing teacher access required'; end if;
  insert into public.classes(id, name, code, teacher_id) values ('class-' || extensions.gen_random_uuid()::text, trim(p_name), upper(trim(p_code)), (select auth.uid())) returning * into v_class; return v_class;
end $$;

create or replace function public.create_activity_for_class(p_class_id text, p_activity jsonb)
returns public.activities language plpgsql security definer set search_path = '' as $$
declare v_activity public.activities;
begin
  if not private.teacher_owns_class(p_class_id) then raise exception 'teacher access required'; end if;
  insert into public.activities(id, slug, title, description, config, status) values (p_activity->>'id', p_activity->>'slug', p_activity->>'title', p_activity->>'description', p_activity, p_activity->>'status') returning * into v_activity;
  insert into public.class_activities(id, class_id, activity_id, is_featured) values ('class-activity-' || extensions.gen_random_uuid()::text, p_class_id, v_activity.id, false);
  return v_activity;
end $$;

create or replace function public.update_activity_for_teacher(p_activity jsonb)
returns public.activities language plpgsql security definer set search_path = '' as $$
declare v_old public.activities; v_activity public.activities;
begin
  select a.* into v_old from public.activities a join public.class_activities ca on ca.activity_id = a.id join public.classes c on c.id = ca.class_id where a.id = p_activity->>'id' and c.teacher_id = (select auth.uid()) limit 1;
  if not found or private.is_anonymous_actor() then raise exception 'teacher access required'; end if;
  if exists (select 1 from public.attempts x where x.activity_id = v_old.id) and v_old.config->'requirements' is distinct from p_activity->'requirements' then raise exception 'requirements cannot change after attempts exist'; end if;
  update public.activities set slug = p_activity->>'slug', title = p_activity->>'title', description = p_activity->>'description', config = p_activity, status = p_activity->>'status' where activities.id = v_old.id returning * into v_activity; return v_activity;
end $$;

create or replace function public.archive_activity_for_teacher(p_activity_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.is_anonymous_actor() or not exists (select 1 from public.class_activities ca join public.classes c on c.id = ca.class_id where ca.activity_id = p_activity_id and c.teacher_id = (select auth.uid())) then raise exception 'teacher access required'; end if;
  update public.activities set status = 'archived', config = jsonb_set(config, '{status}', '"archived"') where id = p_activity_id;
end $$;

create or replace function public.set_class_activity(p_class_id text, p_activity_id text, p_is_featured boolean, p_available_from timestamptz default null, p_available_until timestamptz default null)
returns public.class_activities language plpgsql security definer set search_path = '' as $$
declare v_assignment public.class_activities;
begin
  if not private.teacher_owns_class(p_class_id) then raise exception 'teacher access required'; end if;
  if p_available_from is not null and p_available_until is not null and p_available_from >= p_available_until then raise exception 'invalid availability period'; end if;
  if p_is_featured then update public.class_activities set is_featured = false where class_id = p_class_id and activity_id <> p_activity_id; end if;
  update public.class_activities set is_featured = p_is_featured, available_from = p_available_from, available_until = p_available_until where class_id = p_class_id and activity_id = p_activity_id returning * into v_assignment;
  if not found then raise exception 'class activity not found'; end if; return v_assignment;
end $$;

revoke all on function public.get_current_actor(), public.join_student(text,text), public.get_activity_ranking(text), public.add_student_to_class(text,text,text), public.reset_student_access(text), public.create_class_for_teacher(text,text), public.create_activity_for_class(text,jsonb), public.update_activity_for_teacher(jsonb), public.archive_activity_for_teacher(text), public.set_class_activity(text,text,boolean,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_current_actor(), public.join_student(text,text), public.get_activity_ranking(text), public.add_student_to_class(text,text,text), public.reset_student_access(text), public.create_class_for_teacher(text,text), public.create_activity_for_class(text,jsonb), public.update_activity_for_teacher(jsonb), public.archive_activity_for_teacher(text), public.set_class_activity(text,text,boolean,timestamptz,timestamptz) to authenticated;

do $$ declare p record; begin for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename = any(array['classes','students','activities','class_activities','attempts','documents','verification_runs','activity_events']) loop execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename); end loop; end $$;

revoke all on public.classes, public.students, public.activities, public.class_activities, public.attempts, public.documents, public.verification_runs, public.activity_events from anon, authenticated;
grant select on public.classes, public.students, public.activities, public.class_activities to authenticated;
grant select, insert, update on public.attempts, public.documents to authenticated;
grant select, insert on public.verification_runs, public.activity_events to authenticated;

create policy "actor reads allowed classes" on public.classes for select to authenticated using ((not private.is_anonymous_actor() and teacher_id = (select auth.uid())) or (private.is_anonymous_actor() and id = private.current_student_class_id()));
create policy "actor reads allowed students" on public.students for select to authenticated using ((private.is_anonymous_actor() and id = private.current_student_id()) or (not private.is_anonymous_actor() and private.teacher_owns_class(class_id)));
create policy "actor reads allowed assignments" on public.class_activities for select to authenticated using ((not private.is_anonymous_actor() and private.teacher_owns_class(class_id)) or (private.is_anonymous_actor() and class_id = private.current_student_class_id() and (available_from is null or available_from <= now()) and (available_until is null or available_until >= now())));
create policy "actor reads allowed activities" on public.activities for select to authenticated using (exists (select 1 from public.class_activities ca where ca.activity_id = activities.id and ((not private.is_anonymous_actor() and private.teacher_owns_class(ca.class_id)) or (private.is_anonymous_actor() and status = 'published' and ca.class_id = private.current_student_class_id() and (ca.available_from is null or ca.available_from <= now()) and (ca.available_until is null or ca.available_until >= now())))));
create policy "actor reads allowed attempts" on public.attempts for select to authenticated using (exists (select 1 from public.students s where s.id = attempts.student_id and ((private.is_anonymous_actor() and s.id = private.current_student_id()) or (not private.is_anonymous_actor() and private.teacher_owns_class(s.class_id)))));
create policy "student creates own attempts" on public.attempts for insert to authenticated with check (private.is_anonymous_actor() and student_id = private.current_student_id() and exists (select 1 from public.students s join public.class_activities ca on ca.class_id = s.class_id and ca.activity_id = attempts.activity_id join public.activities ac on ac.id = ca.activity_id where s.id = student_id and ac.status = 'published' and (ca.available_from is null or ca.available_from <= now()) and (ca.available_until is null or ca.available_until >= now())));
create policy "student updates open own attempts" on public.attempts for update to authenticated using (private.is_anonymous_actor() and student_id = private.current_student_id() and status <> 'completed') with check (private.is_anonymous_actor() and student_id = private.current_student_id());
create policy "actor reads allowed documents" on public.documents for select to authenticated using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = documents.attempt_id and ((private.is_anonymous_actor() and s.id = private.current_student_id()) or (not private.is_anonymous_actor() and private.teacher_owns_class(s.class_id)))));
create policy "student writes own documents" on public.documents for all to authenticated using (exists (select 1 from public.attempts a where a.id = documents.attempt_id and a.student_id = private.current_student_id() and a.status <> 'completed')) with check (private.is_anonymous_actor() and exists (select 1 from public.attempts a where a.id = documents.attempt_id and a.student_id = private.current_student_id() and a.status <> 'completed'));
create policy "actor reads allowed verification runs" on public.verification_runs for select to authenticated using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = verification_runs.attempt_id and ((private.is_anonymous_actor() and s.id = private.current_student_id()) or (not private.is_anonymous_actor() and private.teacher_owns_class(s.class_id)))));
create policy "student inserts own verification runs" on public.verification_runs for insert to authenticated with check (private.is_anonymous_actor() and exists (select 1 from public.attempts a where a.id = verification_runs.attempt_id and a.student_id = private.current_student_id() and a.status <> 'completed'));
create policy "actor reads allowed events" on public.activity_events for select to authenticated using (exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = activity_events.attempt_id and ((private.is_anonymous_actor() and s.id = private.current_student_id()) or (not private.is_anonymous_actor() and private.teacher_owns_class(s.class_id)))));
create policy "student inserts own events" on public.activity_events for insert to authenticated with check (private.is_anonymous_actor() and exists (select 1 from public.attempts a where a.id = activity_events.attempt_id and a.student_id = private.current_student_id() and a.status <> 'completed'));
