-- Preserve pedagogical history while making document state deterministic.
alter table public.documents
  add column deleted_at timestamptz,
  add column revision integer not null default 0;

alter table public.documents
  add constraint documents_revision_nonnegative check (revision >= 0);

alter table public.verification_runs
  add column document_revision integer;

update public.verification_runs vr
set document_revision = d.revision
from public.documents d
where d.id = vr.document_id;

alter table public.verification_runs
  alter column document_revision set default 0,
  alter column document_revision set not null,
  add constraint verification_runs_document_revision_nonnegative
    check (document_revision >= 0);

create index documents_active_attempt_idx
  on public.documents (attempt_id, id)
  where deleted_at is null;

drop policy if exists "actor reads allowed documents" on public.documents;
drop policy if exists "student writes own documents" on public.documents;

create policy "actor reads allowed documents" on public.documents
for select to authenticated
using (
  exists (
    select 1
    from public.attempts a
    join public.students s on s.id = a.student_id
    where a.id = documents.attempt_id
      and (
        (
          private.is_anonymous_actor()
          and s.id = private.current_student_id()
          and documents.deleted_at is null
        )
        or (
          not private.is_anonymous_actor()
          and private.teacher_owns_class(s.class_id)
        )
      )
  )
);

revoke insert, update, delete on public.documents from authenticated;
grant select on public.documents to authenticated;

create or replace function public.save_document(
  p_attempt_id text,
  p_document_id text,
  p_name text,
  p_content_json jsonb,
  p_preset text
)
returns jsonb
language plpgsql
security definer
set search_path = '' as $$
declare
  v_document public.documents;
  v_now timestamptz := now();
begin
  if not private.is_anonymous_actor() then
    raise exception 'student access required';
  end if;

  perform 1
  from public.attempts a
  join public.students s on s.id = a.student_id
  where a.id = p_attempt_id
    and s.auth_user_id = (select auth.uid())
    and a.status <> 'completed'
  for update of a;
  if not found then raise exception 'open student attempt required'; end if;

  select d.* into v_document
  from public.documents d
  where d.id = p_document_id
  for update;

  if found then
    if v_document.attempt_id <> p_attempt_id or v_document.deleted_at is not null then
      raise exception 'active document does not belong to attempt';
    end if;
    if v_document.name is distinct from trim(p_name)
      or v_document.content_json is distinct from p_content_json
      or v_document.preset is distinct from p_preset then
      update public.documents d
      set name = trim(p_name),
          content_json = p_content_json,
          preset = p_preset,
          revision = d.revision + 1,
          updated_at = v_now
      where d.id = p_document_id
      returning d.* into v_document;
    end if;
  else
    insert into public.documents(
      id, attempt_id, name, content_json, preset, revision, updated_at
    ) values (
      p_document_id, p_attempt_id, trim(p_name), p_content_json, p_preset, 0, v_now
    ) returning * into v_document;
  end if;

  return jsonb_build_object(
    'revision', v_document.revision,
    'updated_at', v_document.updated_at
  );
end $$;

create or replace function public.save_attempt_state(
  p_attempt_id text,
  p_active_document_id text
)
returns void
language plpgsql
security definer
set search_path = '' as $$
begin
  if not private.is_anonymous_actor() or not exists (
    select 1
    from public.attempts a
    join public.students s on s.id = a.student_id
    where a.id = p_attempt_id
      and s.auth_user_id = (select auth.uid())
      and a.status <> 'completed'
  ) then
    raise exception 'open student attempt required';
  end if;
  if not exists (
    select 1
    from public.documents d
    where d.id = p_active_document_id
      and d.attempt_id = p_attempt_id
      and d.deleted_at is null
  ) then
    raise exception 'active document does not belong to attempt';
  end if;
  update public.attempts
  set active_document_id = p_active_document_id,
      updated_at = now()
  where id = p_attempt_id;
end $$;

create or replace function public.delete_document(p_document_id text)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_attempt_id text;
  v_active_document_id text;
  v_fallback_document_id text;
  v_active_count integer;
begin
  if not private.is_anonymous_actor() then
    raise exception 'student access required';
  end if;

  select d.attempt_id into v_attempt_id
  from public.documents d
  where d.id = p_document_id;
  if not found then raise exception 'document not found'; end if;

  select a.active_document_id into v_active_document_id
  from public.attempts a
  join public.students s on s.id = a.student_id
  where a.id = v_attempt_id
    and s.auth_user_id = (select auth.uid())
    and a.status <> 'completed'
  for update of a;
  if not found then raise exception 'open student attempt required'; end if;

  perform 1
  from public.documents d
  where d.id = p_document_id
    and d.attempt_id = v_attempt_id
    and d.deleted_at is null
  for update;
  if not found then raise exception 'active document does not belong to attempt'; end if;

  select count(*) into v_active_count
  from public.documents d
  where d.attempt_id = v_attempt_id
    and d.deleted_at is null;
  if v_active_count <= 1 then
    raise exception 'attempt must keep at least one active document';
  end if;

  if v_active_document_id = p_document_id then
    select d.id into v_fallback_document_id
    from public.documents d
    where d.attempt_id = v_attempt_id
      and d.deleted_at is null
      and d.id <> p_document_id
    order by d.id
    limit 1;

    update public.attempts
    set active_document_id = v_fallback_document_id,
        updated_at = now()
    where id = v_attempt_id;
  end if;

  update public.documents d
  set deleted_at = now(),
      revision = d.revision + 1,
      updated_at = now()
  where d.id = p_document_id;

  insert into public.activity_events(
    id, attempt_id, document_id, type, metadata, created_at
  ) values (
    extensions.gen_random_uuid()::text,
    v_attempt_id,
    p_document_id,
    'document_deleted',
    '{}'::jsonb,
    now()
  );
end $$;

create or replace function public.complete_attempt(
  p_attempt_id text,
  p_document_id text
)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare v_activity_id text;
begin
  if not private.is_anonymous_actor() then raise exception 'student access required'; end if;
  select a.activity_id into v_activity_id
  from public.attempts a
  join public.students s on s.id = a.student_id
  where a.id = p_attempt_id
    and s.auth_user_id = (select auth.uid())
    and a.status <> 'completed'
  for update of a;
  if not found then raise exception 'open student attempt required'; end if;
  if not exists (
    select 1 from public.documents d
    where d.id = p_document_id
      and d.attempt_id = p_attempt_id
      and d.deleted_at is null
  ) then
    raise exception 'active document does not belong to attempt';
  end if;
  update public.attempts
  set status = 'completed',
      completed_at = now(),
      updated_at = now(),
      active_document_id = p_document_id
  where id = p_attempt_id;
  insert into public.activity_events(
    id, attempt_id, document_id, type, metadata, created_at
  ) values (
    extensions.gen_random_uuid()::text,
    p_attempt_id,
    p_document_id,
    'activity_completed',
    '{}'::jsonb,
    now()
  );
end $$;

drop function public.record_official_verification(uuid,text,text,integer,jsonb);

create function public.record_official_verification(
  p_auth_user_id uuid,
  p_attempt_id text,
  p_document_id text,
  p_document_revision integer,
  p_score integer,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_attempt public.attempts;
  v_current_document_revision integer;
  v_total integer;
  v_result jsonb;
  v_now timestamptz := now();
begin
  select a.* into v_attempt
  from public.attempts a
  join public.students s on s.id = a.student_id
  where a.id = p_attempt_id
    and s.auth_user_id = p_auth_user_id
    and a.status <> 'completed'
  for update of a;
  if not found then raise exception 'open student attempt required'; end if;

  select d.revision into v_current_document_revision
  from public.documents d
  where d.id = p_document_id
    and d.attempt_id = p_attempt_id
    and d.deleted_at is null;
  if not found then raise exception 'active document does not belong to attempt'; end if;
  if p_document_revision < 0 or p_document_revision > v_current_document_revision then
    raise exception 'invalid document revision';
  end if;

  select coalesce(sum((r.value->>'points')::integer), 0) into v_total
  from public.activities ac
  cross join lateral jsonb_array_elements(ac.config->'requirements') r
  where ac.id = v_attempt.activity_id;
  if p_score < 0 or p_score > v_total then raise exception 'invalid official score'; end if;

  insert into public.verification_runs(
    id, attempt_id, document_id, document_revision, score, results_json, created_at
  ) values (
    'verification-' || extensions.gen_random_uuid()::text,
    p_attempt_id,
    p_document_id,
    p_document_revision,
    p_score,
    p_results,
    v_now
  );
  if p_score > v_attempt.current_score then
    update public.attempts
    set current_score = p_score,
        score_reached_at = v_now,
        updated_at = v_now
    where id = p_attempt_id;
  else
    update public.attempts set updated_at = v_now where id = p_attempt_id;
  end if;

  insert into public.activity_events(
    id, attempt_id, document_id, type, metadata, created_at
  ) values
    (
      extensions.gen_random_uuid()::text,
      p_attempt_id,
      p_document_id,
      'verification_requested',
      jsonb_build_object('documentRevision', p_document_revision),
      v_now
    ),
    (
      extensions.gen_random_uuid()::text,
      p_attempt_id,
      p_document_id,
      'verification_completed',
      jsonb_build_object('score', p_score, 'documentRevision', p_document_revision),
      v_now
    );

  for v_result in select value from jsonb_array_elements(p_results) loop
    if coalesce((v_result->>'passed')::boolean, false)
      and not exists (
        select 1 from public.activity_events e
        where e.attempt_id = p_attempt_id
          and e.type = 'requirement_passed'
          and e.metadata->>'requirementId' = v_result->>'id'
      ) then
      insert into public.activity_events(
        id, attempt_id, document_id, type, metadata, created_at
      ) values (
        extensions.gen_random_uuid()::text,
        p_attempt_id,
        p_document_id,
        'requirement_passed',
        jsonb_build_object(
          'requirementId', v_result->>'id',
          'label', v_result->>'label'
        ),
        v_now
      );
    end if;
  end loop;
end $$;

revoke all on function public.save_document(text,text,text,jsonb,text),
  public.delete_document(text),
  public.record_official_verification(uuid,text,text,integer,integer,jsonb)
from public, anon;
revoke all on function public.record_official_verification(uuid,text,text,integer,integer,jsonb)
from authenticated;

grant execute on function public.save_document(text,text,text,jsonb,text),
  public.delete_document(text)
to authenticated;
grant execute on function public.record_official_verification(uuid,text,text,integer,integer,jsonb)
to service_role;
