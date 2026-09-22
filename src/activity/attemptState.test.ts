import assert from 'node:assert/strict'
import test from 'node:test'
import type { ActivityDocument } from '../types/activity'
import type { VerificationRun } from '../types/platform'
import { canEditAttempt, isDocumentDirty } from './attemptState'

const document: ActivityDocument = { id: 'document-1', name: 'Documento', content: { type: 'doc' }, preset: 'normal', revision: 3, updatedAt: '2026-01-02T10:00:00.000Z' }
const run: VerificationRun = { id: 'run-1', attemptId: 'attempt-1', documentId: document.id, score: 0, results: [], documentRevision: 2, createdAt: '2026-01-01T10:00:00.000Z' }

test('revision define dirty sem depender dos relógios de cliente e servidor', () => {
  assert.equal(isDocumentDirty(document, run), true)
  assert.equal(isDocumentDirty({ ...document, revision: 2, updatedAt: '2030-12-31T10:00:00.000Z' }, run), false)
  assert.equal(isDocumentDirty({ ...document, revision: 3, updatedAt: '2020-12-31T10:00:00.000Z' }, run), true)
})

test('tentativa concluída é somente leitura', () => {
  assert.equal(canEditAttempt({ id: 'attempt-1', studentId: 'student-1', activityId: 'activity-1', startedAt: run.createdAt, currentScore: 0, status: 'completed', documents: [document], activeDocumentId: document.id, verificationRuns: [run], events: [], updatedAt: document.updatedAt }), false)
})
