import type { Activity, SavedActivity } from '../types/activity'

const storageKey = (activityId: string) => `editor-vezetiv:${activityId}`

function isSavedActivity(value: unknown, activityId: string): value is SavedActivity {
  if (typeof value !== 'object' || value === null) return false

  const saved = value as Partial<SavedActivity>
  return (
    saved.activityId === activityId
    && typeof saved.savedAt === 'string'
    && typeof saved.content === 'object'
    && saved.content !== null
    && saved.content.type === 'doc'
  )
}

export function loadSavedActivity(activity: Activity): SavedActivity | null {
  try {
    const raw = localStorage.getItem(storageKey(activity.id))
    if (!raw) return null

    const saved: unknown = JSON.parse(raw)
    return isSavedActivity(saved, activity.id) ? saved : null
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
