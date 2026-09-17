import type { JSONContent } from '@tiptap/core'

export type PastePolicy = 'blocked' | 'allowed'

export interface Activity {
  id: string
  title: string
  description: string
  instructions: string[]
  sourceText: string
  initialContent: JSONContent
  enabledTools: string[]
  pastePolicy: PastePolicy
  requirements: string[]
  expectedTitle: string
}

export interface SavedActivity {
  activityId: string
  content: JSONContent
  savedAt: string
}

export interface CheckResult {
  id: string
  label: string
  passed: boolean
}
