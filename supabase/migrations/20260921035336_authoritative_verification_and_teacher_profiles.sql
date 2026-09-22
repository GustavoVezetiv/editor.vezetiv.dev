-- Final pre-homologation integrity boundary: official verification, explicit
-- attempt operations and provisioned teachers. This migration is incremental.

create table public.teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.teacher_profiles enable row level security;
revoke all on public.teacher_profiles from public, anon, authenticated;
grant select on public.teacher_profiles to authenticated;
create policy "teacher reads own profile" on public.teacher_profiles for select to authenticated
using (user_id = (select auth.uid()));

create or replace function private.is_provisioned_teacher(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.teacher_profiles tp where tp.user_id = p_user_id and tp.active) $$;

create or replace function private.teacher_owns_class(p_class_id text)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_provisioned_teacher((select auth.uid())) and exists (select 1 from public.classes c where c.id = p_class_id and c.teacher_id = (select auth.uid())) and not private.is_anonymous_actor() $$;

create or replace function public.get_current_actor()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_student public.students; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return jsonb_build_object('role', 'anonymous'); end if;
  if not private.is_anonymous_actor() and private.is_provisioned_teacher(v_uid) then
    return jsonb_build_object('role', 'teacher', 'user_id', v_uid);
  end if;
  select * into v_student from public.students s where s.auth_user_id = v_uid limit 1;
  if found then return jsonb_build_object('role', 'student', 'student', jsonb_build_object('id', v_student.id, 'class_id', v_student.class_id, 'code', v_student.code, 'display_name', v_student.display_name, 'created_at', v_student.created_at)); end if;
  return jsonb_build_object('role', 'anonymous');
end $$;

create or replace function public.create_class_for_teacher(p_name text, p_code text)
returns public.classes language plpgsql security definer set search_path = '' as $$
declare v_class public.classes;
begin
  if private.is_anonymous_actor() or not private.is_provisioned_teacher((select auth.uid())) then raise exception 'provisioned teacher access required'; end if;
  insert into public.classes(id, name, code, teacher_id) values ('class-' || extensions.gen_random_uuid()::text, trim(p_name), upper(trim(p_code)), (select auth.uid())) returning * into v_class;
  return v_class;
end $$;

create or replace function public.update_activity_for_teacher(p_activity jsonb)
returns public.activities language plpgsql security definer set search_path = '' as $$
declare v_old public.activities; v_activity public.activities; v_class_id text;
begin
  select a.* into v_old from public.activities a where a.id = p_activity->>'id';
  select ca.class_id into v_class_id from public.class_activities ca where ca.activity_id = v_old.id and private.teacher_owns_class(ca.class_id) limit 1;
  if not found or not private.teacher_owns_class(v_class_id) then raise exception 'teacher access required'; end if;
  if exists (select 1 from public.attempts x where x.activity_id = v_old.id) and v_old.config->'requirements' is distinct from p_activity->'requirements' then raise exception 'requirements cannot change after attempts exist'; end if;
  update public.activities set slug = p_activity->>'slug', title = p_activity->>'title', description = p_activity->>'description', config = p_activity, status = p_activity->>'status' where activities.id = v_old.id returning * into v_activity;
  return v_activity;
end $$;

create or replace function public.archive_activity_for_teacher(p_activity_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.class_activities ca where ca.activity_id = p_activity_id and private.teacher_owns_class(ca.class_id)) then raise exception 'teacher access required'; end if;
  update public.activities set status = 'archived', config = jsonb_set(config, '{status}', '"archived"') where id = p_activity_id;
end $$;

create or replace function private.new_access_code()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; raw text := ''; i integer;
begin
  for i in 1..12 loop raw := raw || substr(alphabet, (get_byte(extensions.gen_random_bytes(1), 0) & 31) + 1, 1); end loop;
  return substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
end $$;

create or replace function public.start_attempt(p_activity_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_student public.students; v_activity public.activities; v_attempt_id text; v_document_id text; v_now timestamptz := now();
begin
  if not private.is_anonymous_actor() then raise exception 'student access required'; end if;
  select * into v_student from public.students s where s.auth_user_id = (select auth.uid()) limit 1;
  if not found then raise exception 'student access required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_student.id || ':' || p_activity_id, 0));
  select a.* into v_activity from public.activities a join public.class_activities ca on ca.activity_id = a.id
  where a.id = p_activity_id and a.status = 'published' and ca.class_id = v_student.class_id
    and (ca.available_from is null or ca.available_from <= v_now) and (ca.available_until is null or ca.available_until >= v_now);
  if not found then raise exception 'activity unavailable'; end if;
  select a.id into v_attempt_id from public.attempts a where a.student_id = v_student.id and a.activity_id = p_activity_id and a.status <> 'completed' limit 1;
  if v_attempt_id is not null then return v_attempt_id; end if;
  select a.id into v_attempt_id from public.attempts a where a.student_id = v_student.id and a.activity_id = p_activity_id and a.status = 'completed' order by a.completed_at desc nulls last limit 1;
  if v_attempt_id is not null then return v_attempt_id; end if;
  v_attempt_id := 'attempt-' || extensions.gen_random_uuid()::text;
  v_document_id := 'document-' || extensions.gen_random_uuid()::text;
  insert into public.attempts(id, student_id, activity_id, started_at, current_score, status, active_document_id, updated_at)
  values (v_attempt_id, v_student.id, p_activity_id, v_now, 0, 'in-progress', v_document_id, v_now);
  insert into public.documents(id, attempt_id, name, content_json, preset, updated_at)
  values (v_document_id, v_attempt_id, 'Documento 1', coalesce(v_activity.config->'initialContent', '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb), coalesce(v_activity.config->>'defaultDocumentPreset', 'normal'), v_now);
  insert into public.activity_events(id, attempt_id, document_id, type, metadata, created_at)
  values (extensions.gen_random_uuid()::text, v_attempt_id, v_document_id, 'activity_started', '{}'::jsonb, v_now);
  return v_attempt_id;
end $$;

create or replace function public.save_attempt_state(p_attempt_id text, p_active_document_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_anonymous_actor() or not exists (select 1 from public.attempts a join public.students s on s.id = a.student_id where a.id = p_attempt_id and s.auth_user_id = (select auth.uid()) and a.status <> 'completed') then raise exception 'open student attempt required'; end if;
  if not exists (select 1 from public.documents d where d.id = p_active_document_id and d.attempt_id = p_attempt_id) then raise exception 'document does not belong to attempt'; end if;
  update public.attempts set active_document_id = p_active_document_id, updated_at = now() where id = p_attempt_id;
end $$;

create or replace function public.complete_attempt(p_attempt_id text, p_document_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_activity_id text;
begin
  if not private.is_anonymous_actor() then raise exception 'student access required'; end if;
  select a.activity_id into v_activity_id from public.attempts a join public.students s on s.id = a.student_id where a.id = p_attempt_id and s.auth_user_id = (select auth.uid()) and a.status <> 'completed' for update of a;
  if not found then raise exception 'open student attempt required'; end if;
  if not exists (select 1 from public.documents d where d.id = p_document_id and d.attempt_id = p_attempt_id) then raise exception 'document does not belong to attempt'; end if;
  update public.attempts set status = 'completed', completed_at = now(), updated_at = now(), active_document_id = p_document_id where id = p_attempt_id;
  insert into public.activity_events(id, attempt_id, document_id, type, metadata, created_at) values (extensions.gen_random_uuid()::text, p_attempt_id, p_document_id, 'activity_completed', '{}'::jsonb, now());
end $$;

create or replace function public.record_official_verification(p_auth_user_id uuid, p_attempt_id text, p_document_id text, p_score integer, p_results jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempt public.attempts; v_total integer; v_result jsonb; v_now timestamptz := now();
begin
  select a.* into v_attempt from public.attempts a join public.students s on s.id = a.student_id where a.id = p_attempt_id and s.auth_user_id = p_auth_user_id and a.status <> 'completed' for update of a;
  if not found then raise exception 'open student attempt required'; end if;
  if not exists (select 1 from public.documents d where d.id = p_document_id and d.attempt_id = p_attempt_id) then raise exception 'document does not belong to attempt'; end if;
  select coalesce(sum((r.value->>'points')::integer), 0) into v_total from public.activities ac cross join lateral jsonb_array_elements(ac.config->'requirements') r where ac.id = v_attempt.activity_id;
  if p_score < 0 or p_score > v_total then raise exception 'invalid official score'; end if;
  insert into public.verification_runs(id, attempt_id, document_id, score, results_json, created_at) values ('verification-' || extensions.gen_random_uuid()::text, p_attempt_id, p_document_id, p_score, p_results, v_now);
  if p_score > v_attempt.current_score then update public.attempts set current_score = p_score, score_reached_at = v_now, updated_at = v_now where id = p_attempt_id; else update public.attempts set updated_at = v_now where id = p_attempt_id; end if;
  insert into public.activity_events(id, attempt_id, document_id, type, metadata, created_at) values
    (extensions.gen_random_uuid()::text, p_attempt_id, p_document_id, 'verification_requested', '{}'::jsonb, v_now),
    (extensions.gen_random_uuid()::text, p_attempt_id, p_document_id, 'verification_completed', jsonb_build_object('score', p_score), v_now);
  for v_result in select value from jsonb_array_elements(p_results) loop
    if coalesce((v_result->>'passed')::boolean, false) and not exists (select 1 from public.activity_events e where e.attempt_id = p_attempt_id and e.type = 'requirement_passed' and e.metadata->>'requirementId' = v_result->>'id') then
      insert into public.activity_events(id, attempt_id, document_id, type, metadata, created_at) values (extensions.gen_random_uuid()::text, p_attempt_id, p_document_id, 'requirement_passed', jsonb_build_object('requirementId', v_result->>'id', 'label', v_result->>'label'), v_now);
    end if;
  end loop;
end $$;

drop policy if exists "student creates own attempts" on public.attempts;
drop policy if exists "student updates open own attempts" on public.attempts;
drop policy if exists "student inserts own verification runs" on public.verification_runs;
drop policy if exists "student inserts own events" on public.activity_events;
revoke insert, update on public.attempts from authenticated;
revoke insert, update, delete on public.verification_runs from authenticated;
grant select on public.attempts, public.verification_runs to authenticated;
grant insert on public.activity_events to authenticated;
create policy "student inserts pedagogical ui events" on public.activity_events for insert to authenticated
with check (private.is_anonymous_actor() and type in ('paste_blocked','document_created','document_renamed','document_deleted','format_applied','hint_opened','preset_changed') and exists (select 1 from public.attempts a where a.id = activity_events.attempt_id and a.student_id = private.current_student_id() and a.status <> 'completed') and (document_id is null or exists (select 1 from public.documents d where d.id = activity_events.document_id and d.attempt_id = activity_events.attempt_id)));

revoke all on function public.start_attempt(text), public.save_attempt_state(text,text), public.complete_attempt(text,text), public.record_official_verification(uuid,text,text,integer,jsonb), private.is_provisioned_teacher(uuid) from public, anon;
revoke all on function public.record_official_verification(uuid,text,text,integer,jsonb) from authenticated;
grant execute on function public.start_attempt(text), public.save_attempt_state(text,text), public.complete_attempt(text,text) to authenticated;
grant execute on function public.record_official_verification(uuid,text,text,integer,jsonb) to service_role;
grant execute on function private.is_provisioned_teacher(uuid) to authenticated;
