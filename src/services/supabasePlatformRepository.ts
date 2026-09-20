import type { SupabaseClient } from '@supabase/supabase-js'
import type { Activity, ActivityDocument } from '../types/activity'
import type { ActivityAttempt, ClassActivity, Classroom, RankedStudent, Student, TeacherDashboard, VerificationRun } from '../types/platform'
import type { PedagogicalEvent } from '../events/pedagogicalEvents'
import type { PlatformRepository, SavedAttempt } from './platformRepository'
import { rankAttempts } from './localPlatformRepository'

const OUTBOX_KEY = 'editor-vezetiv:supabase-outbox:v1'
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

type Row = Record<string, unknown>

function activityFromRow(row: Row): Activity {
  const config = row.config as Activity
  return { ...config, id: String(row.id), slug: String(row.slug), title: String(row.title), description: String(row.description), status: row.status as Activity['status'], availableFrom: row.available_from as string | undefined, availableUntil: row.available_until as string | undefined }
}
const classroomFromRow = (row: Row): Classroom => ({ id: String(row.id), name: String(row.name), code: String(row.code), createdAt: String(row.created_at) })
const studentFromRow = (row: Row): Student => ({ id: String(row.id), classId: String(row.class_id), code: String(row.code), displayName: String(row.display_name), createdAt: String(row.created_at) })
const assignmentFromRow = (row: Row): ClassActivity => ({ id: String(row.id), classId: String(row.class_id), activityId: String(row.activity_id), isFeatured: Boolean(row.is_featured), availableFrom: row.available_from as string | undefined, availableUntil: row.available_until as string | undefined, createdAt: String(row.created_at) })
const documentFromRow = (row: Row): ActivityDocument => ({ id: String(row.id), name: String(row.name), content: row.content_json as ActivityDocument['content'], preset: row.preset as ActivityDocument['preset'], updatedAt: String(row.updated_at) })
const runFromRow = (row: Row): VerificationRun => ({ id: String(row.id), attemptId: String(row.attempt_id), documentId: String(row.document_id), score: Number(row.score), results: row.results_json as VerificationRun['results'], createdAt: String(row.created_at) })
const eventFromRow = (row: Row, fallbackDocumentId: string, activityId: string): PedagogicalEvent => ({ id: String(row.id), activityId, attemptId: String(row.attempt_id), documentId: String(row.document_id ?? fallbackDocumentId), type: row.type as PedagogicalEvent['type'], metadata: row.metadata as Record<string, unknown>, timestamp: String(row.created_at) })

function attemptFromRows(row: Row, documentRows: Row[], runRows: Row[], eventRows: Row[]): ActivityAttempt {
  const documents = documentRows.filter((document) => document.attempt_id === row.id).map(documentFromRow)
  const activeDocumentId = String(row.active_document_id ?? documents[0]?.id ?? '')
  return { id: String(row.id), studentId: String(row.student_id), activityId: String(row.activity_id), startedAt: String(row.started_at), completedAt: row.completed_at as string | undefined, currentScore: Number(row.current_score), scoreReachedAt: row.score_reached_at as string | undefined, status: row.status as ActivityAttempt['status'], documents, activeDocumentId, verificationRuns: runRows.filter((run) => run.attempt_id === row.id).map(runFromRow), events: eventRows.filter((event) => event.attempt_id === row.id).map((event) => eventFromRow(event, activeDocumentId, String(row.activity_id))), updatedAt: String(row.updated_at ?? row.completed_at ?? row.started_at) }
}

export class SupabasePlatformRepository implements PlatformRepository {
  readonly mode = 'supabase' as const
  constructor(private readonly client: SupabaseClient, private readonly storage: Storage = localStorage) {}

  private async rows(table: string, query = this.client.from(table).select('*')): Promise<Row[]> {
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as Row[]
  }

  private readOutbox(): ActivityAttempt[] {
    try { return JSON.parse(this.storage.getItem(OUTBOX_KEY) ?? '[]') as ActivityAttempt[] } catch { return [] }
  }
  private writeOutbox(attempts: ActivityAttempt[]): void { this.storage.setItem(OUTBOX_KEY, JSON.stringify(attempts)) }
  private enqueue(attempt: ActivityAttempt): void { this.writeOutbox([...this.readOutbox().filter((item) => item.id !== attempt.id), clone(attempt)]) }

  async listActivities(student?: Student): Promise<Activity[]> {
    if (!student) return (await this.rows('activities', this.client.from('activities').select('*').neq('status', 'archived'))).map(activityFromRow)
    const current = new Date().toISOString()
    const assignments = (await this.rows('class_activities', this.client.from('class_activities').select('*').eq('class_id', student.classId))).filter((row) => (!row.available_from || String(row.available_from) <= current) && (!row.available_until || String(row.available_until) >= current))
    if (!assignments.length) return []
    const activities = await this.rows('activities', this.client.from('activities').select('*').in('id', assignments.map((row) => row.activity_id)).eq('status', 'published'))
    const assignmentByActivity = new Map(assignments.map((row) => [String(row.activity_id), row]))
    return activities.map(activityFromRow).map((activity) => { const assignment = assignmentByActivity.get(activity.id)!; return { ...activity, isFeatured: Boolean(assignment.is_featured), availableFrom: assignment.available_from as string | undefined, availableUntil: assignment.available_until as string | undefined } })
  }

  async getActivity(activityId: string): Promise<Activity | undefined> {
    const { data, error } = await this.client.from('activities').select('*').eq('id', activityId).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? activityFromRow(data as Row) : undefined
  }

  async join(classCode: string, studentCode: string): Promise<Student> {
    const { data: classroom, error: classError } = await this.client.from('classes').select('id').eq('code', classCode.trim().toUpperCase()).maybeSingle()
    if (classError) throw new Error(classError.message)
    if (!classroom) throw new Error('Turma não encontrada.')
    const { data: authData } = await this.client.auth.getUser()
    if (!authData.user) throw new Error('Sessão Supabase necessária para entrar na turma.')
    const { data: student, error } = await this.client.from('students').select('*').eq('class_id', classroom.id).eq('code', studentCode.trim().toUpperCase()).eq('auth_user_id', authData.user.id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!student) throw new Error('Aluno não encontrado nesta turma.')
    return studentFromRow(student as Row)
  }

  async getStudent(studentId: string): Promise<Student | undefined> {
    const { data, error } = await this.client.from('students').select('*').eq('id', studentId).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? studentFromRow(data as Row) : undefined
  }

  private async loadAttempt(row: Row): Promise<ActivityAttempt> {
    const [documents, runs, events] = await Promise.all([
      this.rows('documents', this.client.from('documents').select('*').eq('attempt_id', row.id)),
      this.rows('verification_runs', this.client.from('verification_runs').select('*').eq('attempt_id', row.id)),
      this.rows('activity_events', this.client.from('activity_events').select('*').eq('attempt_id', row.id)),
    ])
    return attemptFromRows(row, documents, runs, events)
  }

  async openAttempt(studentId: string, activity: Activity): Promise<ActivityAttempt> {
    const { data: existing, error } = await this.client.from('attempts').select('*').eq('student_id', studentId).eq('activity_id', activity.id).neq('status', 'completed').maybeSingle()
    if (error) throw new Error(error.message)
    if (existing) return this.loadAttempt(existing as Row)
    const { data: completed, error: completedError } = await this.client.from('attempts').select('*').eq('student_id', studentId).eq('activity_id', activity.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(1).maybeSingle()
    if (completedError) throw new Error(completedError.message)
    if (completed) return this.loadAttempt(completed as Row)
    const timestamp = new Date().toISOString()
    const attemptId = `attempt-${crypto.randomUUID()}`
    const documentId = `document-${crypto.randomUUID()}`
    const { data: attemptRow, error: attemptError } = await this.client.from('attempts').insert({ id: attemptId, student_id: studentId, activity_id: activity.id, started_at: timestamp, current_score: 0, status: 'in-progress', active_document_id: documentId, updated_at: timestamp }).select('*').single()
    if (attemptError) throw new Error(attemptError.message)
    const document: ActivityDocument = { id: documentId, name: 'Documento 1', content: clone(activity.initialContent), preset: activity.defaultDocumentPreset, updatedAt: timestamp }
    const { error: documentError } = await this.client.from('documents').insert({ id: document.id, attempt_id: attemptId, name: document.name, content_json: document.content, preset: document.preset, updated_at: timestamp })
    if (documentError) throw new Error(documentError.message)
    const event: PedagogicalEvent = { id: crypto.randomUUID(), timestamp, activityId: activity.id, attemptId, documentId, type: 'activity_started', metadata: {} }
    const { error: eventError } = await this.client.from('activity_events').insert({ id: event.id, attempt_id: attemptId, document_id: documentId, type: event.type, metadata: event.metadata, created_at: timestamp })
    if (eventError) throw new Error(eventError.message)
    return { ...attemptFromRows(attemptRow as Row, [{ id: document.id, attempt_id: attemptId, name: document.name, content_json: document.content, preset: document.preset, updated_at: timestamp }], [], [{ ...event, attempt_id: attemptId, document_id: documentId, created_at: timestamp }]), events: [event] }
  }

  private async dependenciesExist(attempt: ActivityAttempt): Promise<boolean> {
    const { data: student } = await this.client.from('students').select('id,class_id').eq('id', attempt.studentId).maybeSingle()
    if (!student) return false
    const [activity, assignment] = await Promise.all([
      this.client.from('activities').select('id').eq('id', attempt.activityId).maybeSingle(),
      this.client.from('class_activities').select('id').eq('class_id', student.class_id).eq('activity_id', attempt.activityId).maybeSingle(),
    ])
    return Boolean(activity.data && assignment.data)
  }

  private async persistAttempt(attempt: ActivityAttempt): Promise<void> {
    if (!(await this.dependenciesExist(attempt))) throw new Error('DEPENDENCY_MISSING')
    const { data: existing } = await this.client.from('attempts').select('status').eq('id', attempt.id).maybeSingle()
    if (existing?.status === 'completed') return
    const { error } = await this.client.from('attempts').upsert({ id: attempt.id, student_id: attempt.studentId, activity_id: attempt.activityId, started_at: attempt.startedAt, completed_at: attempt.completedAt ?? null, current_score: attempt.currentScore, score_reached_at: attempt.scoreReachedAt ?? null, status: attempt.status, active_document_id: attempt.activeDocumentId, updated_at: attempt.updatedAt })
    if (error) throw new Error(error.message)
    const documents = await this.client.from('documents').upsert(attempt.documents.map((document) => ({ id: document.id, attempt_id: attempt.id, name: document.name, content_json: document.content, preset: document.preset, updated_at: document.updatedAt })))
    if (documents.error) throw new Error(documents.error.message)
    if (attempt.verificationRuns.length) { const runs = await this.client.from('verification_runs').upsert(attempt.verificationRuns.map((run) => ({ id: run.id, attempt_id: run.attemptId, document_id: run.documentId, score: run.score, results_json: run.results, created_at: run.createdAt }))); if (runs.error) throw new Error(runs.error.message) }
    if (attempt.events.length) { const events = await this.client.from('activity_events').upsert(attempt.events.map((event) => ({ id: event.id, attempt_id: event.attemptId, document_id: event.documentId, type: event.type, metadata: event.metadata, created_at: event.timestamp }))); if (events.error) throw new Error(events.error.message) }
  }

  async saveAttempt(attempt: ActivityAttempt): Promise<SavedAttempt> {
    try {
      await this.retryPending()
      await this.persistAttempt(attempt)
      this.writeOutbox(this.readOutbox().filter((item) => item.id !== attempt.id))
      return { attempt, remoteState: 'synced' }
    } catch (error) {
      if (error instanceof Error && error.message === 'DEPENDENCY_MISSING') return { attempt, remoteState: 'blocked' }
      this.enqueue(attempt)
      return { attempt, remoteState: 'retrying' }
    }
  }

  async retryPending(): Promise<number> {
    const pending = this.readOutbox()
    let synced = 0
    for (const attempt of pending.slice(0, 10)) {
      try { await this.persistAttempt(attempt); synced += 1 } catch { break }
    }
    if (synced) this.writeOutbox(pending.slice(synced))
    return synced
  }

  async createActivity(activity: Activity, classId?: string): Promise<Activity> {
    if (!classId) throw new Error('Selecione a turma da atividade.')
    const { error } = await this.client.from('activities').insert({ id: activity.id, slug: activity.slug, title: activity.title, description: activity.description, config: activity, status: activity.status })
    if (error) throw new Error(error.message)
    const assignment = await this.client.from('class_activities').insert({ id: `class-activity-${crypto.randomUUID()}`, class_id: classId, activity_id: activity.id, is_featured: activity.isFeatured, available_from: activity.availableFrom ?? null, available_until: activity.availableUntil ?? null })
    if (assignment.error) throw new Error(assignment.error.message)
    return activity
  }

  async dashboard(): Promise<TeacherDashboard> {
    const [classes, students, activities, assignments, attempts, documents, runs, events] = await Promise.all(['classes', 'students', 'activities', 'class_activities', 'attempts', 'documents', 'verification_runs', 'activity_events'].map((table) => this.rows(table)))
    const mappedAttempts = attempts.map((attempt) => attemptFromRows(attempt, documents, runs, events))
    return { classes: classes.map(classroomFromRow), students: students.map(studentFromRow), activities: activities.map(activityFromRow), classActivities: assignments.map(assignmentFromRow), attempts: mappedAttempts, averageScore: mappedAttempts.length ? Math.round(mappedAttempts.reduce((sum, attempt) => sum + attempt.currentScore, 0) / mappedAttempts.length) : 0, completedAttempts: mappedAttempts.filter((attempt) => attempt.status === 'completed').length }
  }

  async ranking(classId: string, activityId: string): Promise<RankedStudent[]> {
    const students = (await this.rows('students', this.client.from('students').select('*').eq('class_id', classId))).map(studentFromRow)
    if (!students.length) return []
    const attemptRows = await this.rows('attempts', this.client.from('attempts').select('*').eq('activity_id', activityId).in('student_id', students.map((student) => student.id)))
    const attempts = attemptRows.map((attempt) => attemptFromRows(attempt, [], [], []))
    return rankAttempts(attempts, students, classId, activityId)
  }
}
