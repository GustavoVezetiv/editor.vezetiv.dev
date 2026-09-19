import type { Activity, ActivityDocument } from '../types/activity'
import type { ActivityAttempt, Classroom, RankedStudent, Student, TeacherDashboard } from '../types/platform'
import { activity01, activity02, activity03, builtInActivities } from '../config/activity01'
import { createPedagogicalEvent } from '../events/pedagogicalEvents'

interface LocalPlatformState {
  seedVersion?: number
  classes: Classroom[]
  students: Student[]
  attempts: ActivityAttempt[]
  activities: Activity[]
}

const KEY = 'editor-vezetiv:platform:v1'
const now = () => new Date().toISOString()
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

function emptyState(): LocalPlatformState {
  const createdAt = now()
  const classroom = { id: 'class-demo', name: 'Turma demonstração', code: 'DEMO', createdAt }
  const students: Student[] = [
    ['student-demo-ana', 'ANA01', 'Ana Souza'], ['student-demo-bruno', 'BRU02', 'Bruno Lima'], ['student-demo-clara', 'CLA03', 'Clara Martins'], ['student-demo-davi', 'DAV04', 'Davi Rocha'], ['student-demo-elisa', 'ELI05', 'Elisa Nunes'],
  ].map(([id, code, displayName], index) => ({ id, classId: classroom.id, code, displayName, createdAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString() }))
  const sampleAttempt = (student: Student, activity: Activity, score: number, status: ActivityAttempt['status'], hoursAgo: number): ActivityAttempt => {
    const timestamp = new Date(Date.now() - hoursAgo * 3_600_000).toISOString()
    const document: ActivityDocument = { id: `document-${student.id}-${activity.id}`, name: 'Documento 1', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Registro de ${student.displayName} para ${activity.title}.` }] }] }, preset: activity.defaultDocumentPreset, updatedAt: timestamp }
    const attemptId = `attempt-${student.id}-${activity.id}`
    const events = [
      createPedagogicalEvent({ activityId: activity.id, attemptId, documentId: document.id, type: 'activity_started', metadata: {} }),
      createPedagogicalEvent({ activityId: activity.id, attemptId, documentId: document.id, type: 'verification_completed', metadata: { score } }),
    ].map((event) => ({ ...event, timestamp }))
    return { id: attemptId, studentId: student.id, activityId: activity.id, startedAt: timestamp, completedAt: status === 'completed' ? timestamp : undefined, currentScore: score, status, documents: [document], activeDocumentId: document.id, verificationRuns: [], events, updatedAt: timestamp }
  }
  const attempts = [
    sampleAttempt(students[0], activity01, 100, 'completed', 30), sampleAttempt(students[1], activity01, 85, 'completed', 25), sampleAttempt(students[2], activity01, 85, 'in-progress', 20), sampleAttempt(students[3], activity02, 60, 'in-progress', 18), sampleAttempt(students[4], activity03, 40, 'in-progress', 12),
  ]
  return { seedVersion: 1, classes: [classroom], students, attempts, activities: [] }
}

function loadState(): LocalPlatformState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '') as Partial<LocalPlatformState>
    if (Array.isArray(parsed.classes) && Array.isArray(parsed.students) && Array.isArray(parsed.attempts) && Array.isArray(parsed.activities)) {
      if (!parsed.seedVersion && parsed.students.length === 0 && parsed.attempts.length === 0 && parsed.activities.length === 0) {
        const seeded = emptyState()
        localStorage.setItem(KEY, JSON.stringify(seeded))
        return seeded
      }
      return parsed as LocalPlatformState
    }
  } catch { /* fall through */ }
  const state = emptyState()
  localStorage.setItem(KEY, JSON.stringify(state))
  return state
}

function saveState(state: LocalPlatformState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function activityList(state: LocalPlatformState, audience: 'student' | 'teacher' = 'student'): Activity[] {
  const current = new Date().toISOString()
  return [...builtInActivities, ...state.activities].filter((activity) => {
    if (audience === 'teacher') return activity.status !== 'archived'
    return activity.status === 'published' && (!activity.availableFrom || activity.availableFrom <= current) && (!activity.availableUntil || activity.availableUntil >= current)
  })
}

export const localPlatformRepository = {
  listActivities(): Activity[] { return clone(activityList(loadState())) },
  listActivitiesForTeacher(): Activity[] { return clone(activityList(loadState(), 'teacher')) },
  getActivity(activityId: string): Activity | undefined { return this.listActivitiesForTeacher().find((activity) => activity.id === activityId) },
  join(classCode: string, studentCode: string, displayName: string): Student {
    const state = loadState()
    const normalizedClassCode = classCode.trim().toUpperCase()
    let classroom = state.classes.find((item) => item.code === normalizedClassCode)
    if (!classroom) {
      classroom = { id: id('class'), name: `Turma ${normalizedClassCode}`, code: normalizedClassCode, createdAt: now() }
      state.classes.push(classroom)
    }
    const normalizedStudentCode = studentCode.trim().toUpperCase()
    let student = state.students.find((item) => item.classId === classroom!.id && item.code === normalizedStudentCode)
    if (!student) {
      student = { id: id('student'), classId: classroom.id, code: normalizedStudentCode, displayName: displayName.trim() || normalizedStudentCode, createdAt: now() }
      state.students.push(student)
      saveState(state)
    }
    return clone(student)
  },
  getStudent(studentId: string): Student | undefined { return clone(loadState().students.find((student) => student.id === studentId)) },
  openAttempt(studentId: string, activity: Activity): ActivityAttempt {
    const state = loadState()
    let attempt = state.attempts.find((item) => item.studentId === studentId && item.activityId === activity.id && item.status !== 'completed')
    if (!attempt) {
      const timestamp = now()
      const document: ActivityDocument = { id: id('document'), name: 'Documento 1', content: clone(activity.initialContent), preset: activity.defaultDocumentPreset, updatedAt: timestamp }
      const attemptId = id('attempt')
      const startedEvent = createPedagogicalEvent({ activityId: activity.id, attemptId, documentId: document.id, type: 'activity_started', metadata: {} })
      attempt = { id: attemptId, studentId, activityId: activity.id, startedAt: timestamp, currentScore: 0, status: 'in-progress', documents: [document], activeDocumentId: document.id, verificationRuns: [], events: [startedEvent], updatedAt: timestamp }
      state.attempts.push(attempt)
      saveState(state)
    }
    return clone(attempt)
  },
  saveAttempt(nextAttempt: ActivityAttempt): ActivityAttempt {
    const state = loadState()
    const next = { ...nextAttempt, updatedAt: now() }
    const index = state.attempts.findIndex((attempt) => attempt.id === next.id)
    if (index >= 0) state.attempts[index] = clone(next)
    else state.attempts.push(clone(next))
    saveState(state)
    return clone(next)
  },
  completeAttempt(attemptId: string): ActivityAttempt | undefined {
    const state = loadState()
    const attempt = state.attempts.find((item) => item.id === attemptId)
    if (!attempt) return undefined
    attempt.status = 'completed'
    attempt.completedAt = now()
    attempt.updatedAt = attempt.completedAt
    saveState(state)
    return clone(attempt)
  },
  createActivity(activity: Activity): Activity {
    const state = loadState()
    state.activities.push(clone(activity))
    saveState(state)
    return clone(activity)
  },
  dashboard(): TeacherDashboard {
    const state = loadState()
    const attempts = state.attempts
    return {
      classes: clone(state.classes), students: clone(state.students), activities: this.listActivitiesForTeacher(), attempts: clone(attempts),
      averageScore: attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.currentScore, 0) / attempts.length) : 0,
      completedAttempts: attempts.filter((attempt) => attempt.status === 'completed').length,
    }
  },
  ranking(activityId: string): RankedStudent[] {
    const state = loadState()
    return state.attempts.filter((attempt) => attempt.activityId === activityId && (attempt.verificationRuns.length > 0 || attempt.currentScore > 0)).map((attempt) => ({
      student: state.students.find((student) => student.id === attempt.studentId)!, score: attempt.currentScore,
      reachedScoreAt: attempt.verificationRuns.at(-1)?.createdAt ?? attempt.startedAt, position: 0,
    })).filter((entry) => Boolean(entry.student)).sort((a, b) => b.score - a.score || a.reachedScoreAt.localeCompare(b.reachedScoreAt)).map((entry, index) => ({ ...entry, position: index + 1 }))
  },
}
