import type { ActivityDocument } from '../types/activity'
import type { ActivityAttempt, VerificationRun } from '../types/platform'

export function isDocumentDirty(document: ActivityDocument, latestRun?: VerificationRun): boolean {
  if (!latestRun) return true
  return new Date(document.updatedAt).getTime() > new Date(latestRun.createdAt).getTime()
}

export function canEditAttempt(attempt: ActivityAttempt): boolean {
  return attempt.status !== 'completed'
}
