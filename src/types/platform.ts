import type { JSONContent } from '@tiptap/core'
import type { Activity, ActivityDocument, DocumentPreset } from './activity'
import type { CheckResult } from '../verification/verifyActivity'
import type { PedagogicalEvent } from '../events/pedagogicalEvents'

export type AttemptStatus = 'not-started' | 'in-progress' | 'completed'

export interface Classroom {
  id: string
  name: string
  code: string
  createdAt: string
}

export interface Student {
  id: string
  classId: string
  code: string
  displayName: string
  createdAt: string
}

export interface ClassActivity {
  id: string
  classId: string
  activityId: string
  isFeatured: boolean
  availableFrom?: string
  availableUntil?: string
  createdAt: string
}

export interface VerificationRun {
  id: string
  attemptId: string
  documentId: string
  score: number
  results: CheckResult[]
  createdAt: string
}

export interface ActivityAttempt {
  id: string
  studentId: string
  activityId: string
  startedAt: string
  completedAt?: string
  currentScore: number
  scoreReachedAt?: string
  status: AttemptStatus
  documents: ActivityDocument[]
  activeDocumentId: string
  verificationRuns: VerificationRun[]
  events: PedagogicalEvent[]
  updatedAt: string
}

export interface RankedStudent {
  student: Student
  score: number
  reachedScoreAt: string
  position: number
}

export interface TeacherDashboard {
  classes: Classroom[]
  students: Student[]
  activities: Activity[]
  classActivities: ClassActivity[]
  attempts: ActivityAttempt[]
  averageScore: number
  completedAttempts: number
}

export interface ActivityDraft {
  title: string
  description: string
  instructions: string[]
  sourceText?: string
  pastePolicy: Activity['pastePolicy']
  defaultDocumentPreset: DocumentPreset
  verificationMode: Activity['verificationMode']
  enabledTools: Activity['enabledTools']
  isFeatured: boolean
  requirements: Activity['requirements']
  hints: Activity['hints']
}

export interface DocumentSnapshot {
  content: JSONContent
  preset: DocumentPreset
}
