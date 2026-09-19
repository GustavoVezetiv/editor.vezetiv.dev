import type { Activity } from '../types/activity'
import type { ActivityAttempt } from '../types/platform'
import { localPlatformRepository } from './localPlatformRepository'
import { supabase } from './supabase'

export type RemoteSaveState = 'local' | 'synced' | 'retrying'
export interface SavedAttempt { attempt: ActivityAttempt; remoteState: RemoteSaveState }

async function syncAttemptToSupabase(attempt: ActivityAttempt): Promise<RemoteSaveState> {
  if (!supabase) return 'local'
  const { error } = await supabase.from('attempts').upsert({
    id: attempt.id, student_id: attempt.studentId, activity_id: attempt.activityId, started_at: attempt.startedAt,
    completed_at: attempt.completedAt ?? null, current_score: attempt.currentScore, status: attempt.status,
  })
  if (error) return 'retrying'
  const writes = [
    supabase.from('documents').upsert(attempt.documents.map((document) => ({ id: document.id, attempt_id: attempt.id, name: document.name, content_json: document.content, preset: document.preset, updated_at: document.updatedAt }))),
    attempt.verificationRuns.length ? supabase.from('verification_runs').upsert(attempt.verificationRuns.map((run) => ({ id: run.id, attempt_id: run.attemptId, document_id: run.documentId, score: run.score, results_json: run.results, created_at: run.createdAt }))) : Promise.resolve({ error: null }),
    attempt.events.length ? supabase.from('activity_events').upsert(attempt.events.map((event) => ({ id: event.id, attempt_id: event.attemptId, document_id: event.documentId, type: event.type, metadata: event.metadata, created_at: event.timestamp }))) : Promise.resolve({ error: null }),
  ]
  const results = await Promise.all(writes)
  return results.some((result) => result.error) ? 'retrying' : 'synced'
}

export const platformRepository = {
  ...localPlatformRepository,
  openAttempt(studentId: string, activity: Activity) {
    const attempt = localPlatformRepository.openAttempt(studentId, activity)
    void syncAttemptToSupabase(attempt)
    return attempt
  },
  async saveAttempt(attempt: ActivityAttempt): Promise<SavedAttempt> {
    const saved = localPlatformRepository.saveAttempt(attempt)
    return { attempt: saved, remoteState: await syncAttemptToSupabase(saved) }
  },
}
