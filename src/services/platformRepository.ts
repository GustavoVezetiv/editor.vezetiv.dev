import type { Activity } from '../types/activity'
import type { ActivityAttempt } from '../types/platform'
import { localPlatformRepository } from './localPlatformRepository'
import { supabase } from './supabase'

async function syncAttemptToSupabase(attempt: ActivityAttempt): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('attempts').upsert({
    id: attempt.id, student_id: attempt.studentId, activity_id: attempt.activityId, started_at: attempt.startedAt,
    completed_at: attempt.completedAt ?? null, current_score: attempt.currentScore, status: attempt.status,
  })
  if (error) { console.warn('Sincronização Supabase indisponível; mantendo dados locais.', error.message); return }
  await supabase.from('documents').upsert(attempt.documents.map((document) => ({ id: document.id, attempt_id: attempt.id, name: document.name, content_json: document.content, preset: document.preset, updated_at: document.updatedAt })))
  if (attempt.verificationRuns.length) await supabase.from('verification_runs').upsert(attempt.verificationRuns.map((run) => ({ id: run.id, attempt_id: run.attemptId, document_id: run.documentId, score: run.score, results_json: run.results, created_at: run.createdAt })))
  if (attempt.events.length) await supabase.from('activity_events').upsert(attempt.events.map((event) => ({ id: event.id, attempt_id: event.attemptId, document_id: event.documentId, type: event.type, metadata: event.metadata, created_at: event.timestamp })))
}

export const platformRepository = {
  ...localPlatformRepository,
  openAttempt(studentId: string, activity: Activity) {
    const attempt = localPlatformRepository.openAttempt(studentId, activity)
    void syncAttemptToSupabase(attempt)
    return attempt
  },
  saveAttempt(attempt: ActivityAttempt) {
    const saved = localPlatformRepository.saveAttempt(attempt)
    void syncAttemptToSupabase(saved)
    return saved
  },
}
