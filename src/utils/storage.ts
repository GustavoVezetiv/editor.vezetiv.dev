import type { JSONContent } from '@tiptap/core'
import type { Activity, ActivityDocument, SavedActivity } from '../types/activity'

const storageKey = (activityId: string) => `editor-vezetiv:${activityId}`

function isDocument(value: unknown): value is ActivityDocument {
  if (typeof value !== 'object' || value === null) return false
  const document = value as Partial<ActivityDocument>
  return typeof document.id === 'string'
    && typeof document.name === 'string'
    && typeof document.updatedAt === 'string'
    && (document.revision === undefined || typeof document.revision === 'number')
    && (document.preset === 'academic-abnt' || document.preset === 'normal')
    && typeof document.content === 'object'
    && document.content !== null
    && document.content.type === 'doc'
}

const normalizeSavedActivity = (saved: SavedActivity): SavedActivity => ({
  ...saved,
  documents: saved.documents.map((document) => ({
    ...document,
    revision: Number.isInteger(document.revision) ? document.revision : 0,
  })),
})

function isSavedActivity(value: unknown, activityId: string): value is SavedActivity {
  if (typeof value !== 'object' || value === null) return false
  const saved = value as Partial<SavedActivity>
  return saved.activityId === activityId
    && typeof saved.attemptId === 'string'
    && typeof saved.savedAt === 'string'
    && typeof saved.activeDocumentId === 'string'
    && Array.isArray(saved.documents)
    && saved.documents.length > 0
    && saved.documents.every(isDocument)
    && saved.documents.some((document) => document.id === saved.activeDocumentId)
}

function migrateLegacyActivity(value: unknown, activity: Activity): SavedActivity | null {
  if (typeof value !== 'object' || value === null) return null
  const legacy = value as { activityId?: unknown; content?: unknown; savedAt?: unknown }
  const legacyContent = legacy.content as { type?: unknown } | null
  if (legacy.activityId !== activity.id || typeof legacy.savedAt !== 'string' || typeof legacy.content !== 'object' || legacyContent === null || legacyContent.type !== 'doc') {
    return null
  }

  return {
    attemptId: 'attempto-local-legado',
    activityId: activity.id,
    activeDocumentId: 'documento-1',
    documents: [{
      id: 'documento-1',
      name: 'Documento 1',
      content: legacy.content as JSONContent,
      preset: activity.defaultDocumentPreset,
      revision: 0,
      updatedAt: legacy.savedAt,
    }],
    savedAt: legacy.savedAt,
  }
}

function migrateWorkspaceWithoutAttempt(value: unknown, activityId: string): SavedActivity | null {
  if (typeof value !== 'object' || value === null) return null
  const workspace = value as Partial<SavedActivity>
  if (workspace.activityId !== activityId
    || typeof workspace.savedAt !== 'string'
    || typeof workspace.activeDocumentId !== 'string'
    || !Array.isArray(workspace.documents)
    || workspace.documents.length === 0
    || !workspace.documents.every(isDocument)
    || !workspace.documents.some((document) => document.id === workspace.activeDocumentId)) return null

  return normalizeSavedActivity({ ...workspace, attemptId: 'attempto-local-legado' } as SavedActivity)
}

export function loadSavedActivity(activity: Activity): SavedActivity | null {
  try {
    const raw = localStorage.getItem(storageKey(activity.id))
    if (!raw) return null

    const saved: unknown = JSON.parse(raw)
    return isSavedActivity(saved, activity.id)
      ? normalizeSavedActivity(saved)
      : migrateWorkspaceWithoutAttempt(saved, activity.id) ?? migrateLegacyActivity(saved, activity)
  } catch {
    return null
  }
}

export function saveActivity(savedActivity: SavedActivity): boolean {
  try {
    localStorage.setItem(storageKey(savedActivity.activityId), JSON.stringify(savedActivity))
    return true
  } catch {
    return false
  }
}
