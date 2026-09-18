import type { JSONContent } from '@tiptap/core'

export type PastePolicy = 'blocked' | 'allowed'
export type VerificationMode = 'manual' | 'live'
export type DocumentPreset = 'academic-abnt' | 'normal'

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

interface BaseRequirement {
  id: string
  label: string
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

export interface OrderedListRequirement extends BaseRequirement {
  type: 'ordered-list'
  minItems: number
}

export type ActivityRequirement = HeadingRequirement | AlignmentRequirement | TextMarkRequirement | OrderedListRequirement

export interface Activity {
  id: string
  title: string
  description: string
  instructions: string[]
  sourceText: string
  initialContent: JSONContent
  enabledTools: EditorTool[]
  pastePolicy: PastePolicy
  verificationMode: VerificationMode
  defaultDocumentPreset: DocumentPreset
  requirements: ActivityRequirement[]
}

export interface ActivityDocument {
  id: string
  name: string
  content: JSONContent
  preset: DocumentPreset
  updatedAt: string
}

export interface SavedActivity {
  activityId: string
  documents: ActivityDocument[]
  activeDocumentId: string
  savedAt: string
}
