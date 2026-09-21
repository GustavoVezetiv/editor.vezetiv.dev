import assert from 'node:assert/strict'
import test from 'node:test'
import type { VerificationRun } from '../types/platform'
import { bestVerificationRun, completionScore, scoreStateFromRuns } from './attemptScoring'

const run = (id: string, documentId: string, score: number, createdAt: string): VerificationRun => ({ id, attemptId: 'attempt', documentId, score, results: [], createdAt })

test('mantém o maior score entre documentos da tentativa', () => {
  const state = scoreStateFromRuns([
    run('one', 'document-1', 90, '2026-01-01T10:00:00.000Z'),
    run('two', 'document-2', 0, '2026-01-01T11:00:00.000Z'),
  ])
  assert.equal(state.currentScore, 90)
})

test('identifica documento e primeira ocorrência do melhor resultado', () => {
  const runs = [
    run('one', 'document-1', 100, '2026-01-01T10:00:00.000Z'),
    run('two', 'document-2', 0, '2026-01-01T11:00:00.000Z'),
    run('three', 'document-3', 100, '2026-01-01T12:00:00.000Z'),
  ]
  const best = bestVerificationRun({ verificationRuns: runs })
  assert.equal(best?.documentId, 'document-1')
  assert.equal(best?.createdAt, '2026-01-01T10:00:00.000Z')
})

test('conclusão exibe score geral oficial, não o último documento ativo', () => {
  assert.equal(completionScore({ currentScore: 100 }), 100)
})

test('reachedScoreAt é a primeira vez em que o melhor score foi atingido', () => {
  const state = scoreStateFromRuns([
    run('one', 'document-1', 80, '2026-01-01T10:00:00.000Z'),
    run('two', 'document-1', 90, '2026-01-01T11:00:00.000Z'),
    run('three', 'document-1', 80, '2026-01-01T12:00:00.000Z'),
    run('four', 'document-2', 90, '2026-01-01T13:00:00.000Z'),
  ])
  assert.deepEqual(state, { currentScore: 90, scoreReachedAt: '2026-01-01T11:00:00.000Z' })
})
