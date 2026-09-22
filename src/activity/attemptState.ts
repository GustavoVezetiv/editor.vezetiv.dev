import type { ActivityDocument } from '../types/activity'
import type { ActivityAttempt, VerificationRun } from '../types/platform'

export function isDocumentDirty(document: ActivityDocument, latestRun?: VerificationRun): boolean {
  if (!latestRun) return true
  return document.revision !== latestRun.documentRevision
}

export function canEditAttempt(attempt: ActivityAttempt): boolean {
  return attempt.status !== 'completed'
}
