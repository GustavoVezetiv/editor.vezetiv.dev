import type { JSONContent } from '@tiptap/core'

export type PastePolicy = 'blocked' | 'allowed'
export type VerificationMode = 'manual' | 'live'
export type DocumentPreset = 'academic-abnt' | 'normal'
export type ActivityStatus = 'draft' | 'published' | 'archived'

export type EditorTool =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'heading'
  | 'fontSize'
  | 'alignment'
  | 'bulletList'
  | 'orderedList'

export interface ActivityHint {
  requirementId: string
  title: string
  steps: string[]
}

interface BaseRequirement {
  id: string
  label: string
  objective: string
  points: number
}

export interface HeadingRequirement extends BaseRequirement {
  type: 'heading'
  level: 1 | 2
  text: string
}

export interface AlignmentRequirement extends BaseRequirement {
  type: 'alignment'
  target: string
  value: 'left' | 'center' | 'right' | 'justify'
}

export interface TextMarkRequirement extends BaseRequirement {
  type: 'text-mark'
  text: string
  mark: 'bold' | 'italic' | 'underline'
}

export interface TextRequirement extends BaseRequirement {
  type: 'text-content'
  text: string
  matchMode: 'exact' | 'normalized' | 'similarity'
  similarityThreshold?: number
}

export interface OrderedListRequirement extends BaseRequirement {
  type: 'ordered-list'
  minItems: number
}

export interface BulletListRequirement extends BaseRequirement {
  type: 'bullet-list'
  minItems: number
}

export interface DocumentPresetRequirement extends BaseRequirement {
  type: 'document-preset'
  preset: DocumentPreset
}

export interface SpellingRequirement extends BaseRequirement {
  type: 'spelling'
}

export type ActivityRequirement = HeadingRequirement | AlignmentRequirement | TextMarkRequirement | TextRequirement | OrderedListRequirement | BulletListRequirement | DocumentPresetRequirement | SpellingRequirement

export interface ActivityScoring {
  totalPoints: number
}

export interface Activity {
  id: string
  slug: string
  title: string
  description: string
  instructions: string[]
  sourceText?: string
  initialContent: JSONContent
  enabledTools: EditorTool[]
  pastePolicy: PastePolicy
  verificationMode: VerificationMode
  defaultDocumentPreset: DocumentPreset
  requirements: ActivityRequirement[]
  hints: ActivityHint[]
  scoring: ActivityScoring
  status: ActivityStatus
}

export interface ActivityDocument {
  id: string
  name: string
  content: JSONContent
  preset: DocumentPreset
  updatedAt: string
}

export interface SavedActivity {
  attemptId: string
  activityId: string
  documents: ActivityDocument[]
  activeDocumentId: string
  savedAt: string
}
