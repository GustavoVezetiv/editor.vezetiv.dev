-- Incremental indexes for the student, activity and teacher-dashboard read paths.
-- The initial migration is intentionally left untouched.
create index if not exists attempts_student_activity_updated_idx
  on public.attempts (student_id, activity_id, started_at desc);

create index if not exists attempts_activity_score_idx
  on public.attempts (activity_id, current_score desc, started_at asc);

create index if not exists documents_attempt_updated_idx
  on public.documents (attempt_id, updated_at desc);

create index if not exists verification_runs_attempt_created_idx
  on public.verification_runs (attempt_id, created_at desc);

create index if not exists activity_events_attempt_created_idx
  on public.activity_events (attempt_id, created_at desc);
