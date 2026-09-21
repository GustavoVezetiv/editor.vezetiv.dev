import type { ActivityAttempt, VerificationRun } from '../types/platform'

export interface AttemptScoreState {
  currentScore: number
  scoreReachedAt?: string
}

export function scoreStateFromRuns(runs: VerificationRun[]): AttemptScoreState {
  if (!runs.length) return { currentScore: 0 }
  const currentScore = runs.reduce((best, run) => Math.max(best, run.score), 0)
  const scoreReachedAt = runs
    .filter((run) => run.score === currentScore)
    .reduce((earliest, run) => !earliest || run.createdAt < earliest ? run.createdAt : earliest, '')
  return { currentScore, scoreReachedAt: scoreReachedAt || undefined }
}

export function newlyPassedRequirementIds(attempt: ActivityAttempt, run: VerificationRun): string[] {
  const recorded = new Set(attempt.events.filter((event) => event.type === 'requirement_passed').map((event) => String(event.metadata.requirementId ?? '')))
  return run.results.filter((result) => result.passed && !recorded.has(result.id)).map((result) => result.id)
}
