import type { Activity, ActivityDocument } from '../types/activity'
import type { ActivityAttempt, ClassActivity, Classroom, RankedStudent, Student, TeacherDashboard, VerificationRun } from '../types/platform'
import { activity01, activity02, activity03, builtInActivities } from '../config/activity01'
import { createPedagogicalEvent } from '../events/pedagogicalEvents'

interface LocalPlatformState {
  seedVersion: number
  classes: Classroom[]
  students: Student[]
  attempts: ActivityAttempt[]
  activities: Activity[]
  classActivities: ClassActivity[]
}

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface LocalRepositoryOptions { demoMode?: boolean; storage?: StorageLike }

const KEY = 'editor-vezetiv:platform:v2'
const now = () => new Date().toISOString()
const clone = <T,>(value: T): T => {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value)) as T
}
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

function reachedScoreAt(attempt: ActivityAttempt): string {
  if (attempt.scoreReachedAt) return attempt.scoreReachedAt
  const matchingRuns = attempt.verificationRuns.filter((run) => run.score === attempt.currentScore)
  return matchingRuns[0]?.createdAt ?? attempt.completedAt ?? attempt.updatedAt ?? attempt.startedAt
}

export function rankAttempts(attempts: ActivityAttempt[], students: Student[], classId: string, activityId: string): RankedStudent[] {
  const studentsById = new Map(students.filter((student) => student.classId === classId).map((student) => [student.id, student]))
  const bestByStudent = new Map<string, ActivityAttempt>()
  for (const attempt of attempts) {
    if (attempt.activityId !== activityId || !studentsById.has(attempt.studentId)) continue
    const current = bestByStudent.get(attempt.studentId)
    if (!current || attempt.currentScore > current.currentScore || (attempt.currentScore === current.currentScore && reachedScoreAt(attempt) < reachedScoreAt(current))) bestByStudent.set(attempt.studentId, attempt)
  }
  return [...bestByStudent.values()].map((attempt) => ({ student: studentsById.get(attempt.studentId)!, score: attempt.currentScore, reachedScoreAt: reachedScoreAt(attempt), position: 0 }))
    .sort((a, b) => b.score - a.score || a.reachedScoreAt.localeCompare(b.reachedScoreAt) || a.student.id.localeCompare(b.student.id))
    .map((entry, index) => ({ ...entry, position: index + 1 }))
}

function createSeedState(): LocalPlatformState {
  const createdAt = now()
  const classroom: Classroom = { id: 'class-demo', name: 'Turma demonstração', code: 'DEMO', createdAt }
  const students: Student[] = [
    ['student-demo-ana', 'ANA01', 'Ana Souza'], ['student-demo-bruno', 'BRU02', 'Bruno Lima'], ['student-demo-clara', 'CLA03', 'Clara Martins'], ['student-demo-davi', 'DAV04', 'Davi Rocha'], ['student-demo-elisa', 'ELI05', 'Elisa Nunes'],
  ].map(([studentId, code, displayName], index) => ({ id: studentId, classId: classroom.id, code, displayName, createdAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString() }))
  const classActivities: ClassActivity[] = builtInActivities.map((activity, index) => ({ id: `class-activity-demo-${index + 1}`, classId: classroom.id, activityId: activity.id, isFeatured: index === 0, createdAt }))
  const sampleAttempt = (student: Student, activity: Activity, score: number, status: ActivityAttempt['status'], hoursAgo: number): ActivityAttempt => {
    const timestamp = new Date(Date.now() - hoursAgo * 3_600_000).toISOString()
    const document: ActivityDocument = { id: `document-${student.id}-${activity.id}`, name: 'Documento 1', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Registro de ${student.displayName} para ${activity.title}.` }] }] }, preset: activity.defaultDocumentPreset, updatedAt: timestamp }
    const attemptId = `attempt-${student.id}-${activity.id}`
    const verificationRuns: VerificationRun[] = score ? [{ id: `verification-${attemptId}`, attemptId, documentId: document.id, score, results: [], createdAt: timestamp }] : []
    const events = [createPedagogicalEvent({ activityId: activity.id, attemptId, documentId: document.id, type: 'activity_started', metadata: {} }), createPedagogicalEvent({ activityId: activity.id, attemptId, documentId: document.id, type: 'verification_completed', metadata: { score } })].map((event) => ({ ...event, timestamp }))
    return { id: attemptId, studentId: student.id, activityId: activity.id, startedAt: timestamp, completedAt: status === 'completed' ? timestamp : undefined, currentScore: score, scoreReachedAt: timestamp, status, documents: [document], activeDocumentId: document.id, verificationRuns, events, updatedAt: timestamp }
  }
  return {
    seedVersion: 2,
    classes: [classroom], students, activities: [], classActivities,
    attempts: [sampleAttempt(students[0], activity01, 100, 'completed', 30), sampleAttempt(students[1], activity01, 85, 'completed', 25), sampleAttempt(students[2], activity01, 85, 'in-progress', 20), sampleAttempt(students[3], activity02, 60, 'in-progress', 18), sampleAttempt(students[4], activity03, 40, 'in-progress', 12)],
  }
}

export class LocalPlatformRepository {
  readonly mode = 'local' as const
  readonly demoMode: boolean
  private readonly storage: StorageLike

  constructor(options: LocalRepositoryOptions = {}) {
    this.demoMode = options.demoMode ?? true
    this.storage = options.storage ?? { getItem: (key) => globalThis.localStorage?.getItem(key) ?? null, setItem: (key, value) => globalThis.localStorage?.setItem(key, value) }
  }

  private loadState(): LocalPlatformState {
    try {
      const parsed = JSON.parse(this.storage.getItem(KEY) ?? '') as Partial<LocalPlatformState>
      if (Array.isArray(parsed.classes) && Array.isArray(parsed.students) && Array.isArray(parsed.attempts) && Array.isArray(parsed.activities)) {
        const activities = [...builtInActivities, ...parsed.activities]
        const firstClass = parsed.classes[0]
        const classActivities = Array.isArray(parsed.classActivities) ? parsed.classActivities : firstClass ? activities.map((activity, index) => ({ id: `class-activity-migrated-${index}`, classId: firstClass.id, activityId: activity.id, isFeatured: index === 0, createdAt: firstClass.createdAt })) : []
        const migrated: LocalPlatformState = { seedVersion: 2, classes: parsed.classes, students: parsed.students, attempts: parsed.attempts, activities: parsed.activities, classActivities }
        this.saveState(migrated)
        return migrated
      }
    } catch { /* create a valid seed below */ }
    const state = createSeedState()
    this.saveState(state)
    return state
  }

  private saveState(state: LocalPlatformState): void { this.storage.setItem(KEY, JSON.stringify(state)) }
  private allActivities(state: LocalPlatformState): Activity[] { return [...builtInActivities, ...state.activities] }

  listActivities(student?: Student): Activity[] {
    const state = this.loadState()
    if (!student) return clone(this.allActivities(state).filter((activity) => activity.status !== 'archived'))
    const current = now()
    const assignments = new Map(state.classActivities.filter((assignment) => assignment.classId === student.classId && (!assignment.availableFrom || assignment.availableFrom <= current) && (!assignment.availableUntil || assignment.availableUntil >= current)).map((assignment) => [assignment.activityId, assignment]))
    return clone(this.allActivities(state).filter((activity) => activity.status === 'published' && assignments.has(activity.id)).map((activity) => {
      const assignment = assignments.get(activity.id)!
      return { ...activity, isFeatured: assignment.isFeatured, availableFrom: assignment.availableFrom, availableUntil: assignment.availableUntil }
    }))
  }

  getActivity(activityId: string): Activity | undefined { return clone(this.allActivities(this.loadState()).find((activity) => activity.id === activityId)) }

  join(classCode: string, studentCode: string, displayName: string): Student {
    const state = this.loadState()
    const normalizedClassCode = classCode.trim().toUpperCase()
    let classroom = state.classes.find((item) => item.code === normalizedClassCode)
    if (!classroom && !this.demoMode) throw new Error('Turma não encontrada.')
    if (!classroom) {
      classroom = { id: id('class'), name: `Turma ${normalizedClassCode}`, code: normalizedClassCode, createdAt: now() }
      state.classes.push(classroom)
    }
    const normalizedStudentCode = studentCode.trim().toUpperCase()
    let student = state.students.find((item) => item.classId === classroom.id && item.code === normalizedStudentCode)
    if (!student && !this.demoMode) throw new Error('Aluno não encontrado nesta turma.')
    if (!student) {
      student = { id: id('student'), classId: classroom.id, code: normalizedStudentCode, displayName: displayName.trim() || normalizedStudentCode, createdAt: now() }
      state.students.push(student)
    }
    this.saveState(state)
    return clone(student)
  }

  getStudent(studentId: string): Student | undefined { return clone(this.loadState().students.find((student) => student.id === studentId)) }

  openAttempt(studentId: string, activity: Activity): ActivityAttempt {
    const state = this.loadState()
    const student = state.students.find((item) => item.id === studentId)
    if (!student || !state.classActivities.some((assignment) => assignment.classId === student.classId && assignment.activityId === activity.id)) throw new Error('Atividade não atribuída a esta turma.')
    let attempt = state.attempts.find((item) => item.studentId === studentId && item.activityId === activity.id && item.status !== 'completed')
      ?? state.attempts.filter((item) => item.studentId === studentId && item.activityId === activity.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    if (!attempt) {
      const timestamp = now()
      const document: ActivityDocument = { id: id('document'), name: 'Documento 1', content: clone(activity.initialContent), preset: activity.defaultDocumentPreset, updatedAt: timestamp }
      const attemptId = id('attempt')
      const startedEvent = createPedagogicalEvent({ activityId: activity.id, attemptId, documentId: document.id, type: 'activity_started', metadata: {} })
      attempt = { id: attemptId, studentId, activityId: activity.id, startedAt: timestamp, currentScore: 0, status: 'in-progress', documents: [document], activeDocumentId: document.id, verificationRuns: [], events: [startedEvent], updatedAt: timestamp }
      state.attempts.push(attempt)
      this.saveState(state)
    }
    return clone(attempt)
  }

  saveAttempt(nextAttempt: ActivityAttempt): ActivityAttempt {
    const state = this.loadState()
    const existing = state.attempts.find((attempt) => attempt.id === nextAttempt.id)
    if (existing?.status === 'completed' && JSON.stringify(existing) !== JSON.stringify(nextAttempt)) return clone(existing)
    const next = { ...nextAttempt, updatedAt: now() }
    const index = state.attempts.findIndex((attempt) => attempt.id === next.id)
    if (index >= 0) state.attempts[index] = clone(next)
    else state.attempts.push(clone(next))
    this.saveState(state)
    return clone(next)
  }

  createActivity(activity: Activity, classId?: string): Activity {
    const state = this.loadState()
    state.activities.push(clone(activity))
    const targetClassId = classId ?? state.classes[0]?.id
    if (targetClassId) state.classActivities.push({ id: id('class-activity'), classId: targetClassId, activityId: activity.id, isFeatured: false, availableFrom: activity.availableFrom, availableUntil: activity.availableUntil, createdAt: now() })
    this.saveState(state)
    return clone(activity)
  }

  dashboard(): TeacherDashboard {
    const state = this.loadState()
    const attempts = state.attempts
    return { classes: clone(state.classes), students: clone(state.students), activities: clone(this.allActivities(state).filter((activity) => activity.status !== 'archived')), classActivities: clone(state.classActivities), attempts: clone(attempts), averageScore: attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.currentScore, 0) / attempts.length) : 0, completedAttempts: attempts.filter((attempt) => attempt.status === 'completed').length }
  }

  ranking(classId: string, activityId: string): RankedStudent[] { const state = this.loadState(); return clone(rankAttempts(state.attempts, state.students, classId, activityId)) }
}

export const localPlatformRepository = new LocalPlatformRepository({ demoMode: true })
