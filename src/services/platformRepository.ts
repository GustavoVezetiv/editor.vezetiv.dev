import type { Activity } from '../types/activity'
import type { ActivityAttempt, RankedStudent, Student, TeacherDashboard } from '../types/platform'
import { LocalPlatformRepository } from './localPlatformRepository'
import { isSupabaseConfigured, supabase } from './supabase'
import { SupabasePlatformRepository } from './supabasePlatformRepository'

export type RemoteSaveState = 'local' | 'synced' | 'retrying' | 'blocked'
export interface SavedAttempt { attempt: ActivityAttempt; remoteState: RemoteSaveState }

export interface PlatformRepository {
  readonly mode: 'local' | 'supabase'
  listActivities(student?: Student): Promise<Activity[]>
  getActivity(activityId: string): Promise<Activity | undefined>
  join(classCode: string, studentCode: string, displayName: string): Promise<Student>
  getStudent(studentId: string): Promise<Student | undefined>
  openAttempt(studentId: string, activity: Activity): Promise<ActivityAttempt>
  saveAttempt(attempt: ActivityAttempt): Promise<SavedAttempt>
  createActivity(activity: Activity, classId?: string): Promise<Activity>
  dashboard(): Promise<TeacherDashboard>
  ranking(classId: string, activityId: string): Promise<RankedStudent[]>
  retryPending(): Promise<number>
}

class LocalRepositoryAdapter implements PlatformRepository {
  readonly mode = 'local' as const
  constructor(private readonly repository: LocalPlatformRepository) {}
  async listActivities(student?: Student) { return this.repository.listActivities(student) }
  async getActivity(activityId: string) { return this.repository.getActivity(activityId) }
  async join(classCode: string, studentCode: string, displayName: string) { return this.repository.join(classCode, studentCode, displayName) }
  async getStudent(studentId: string) { return this.repository.getStudent(studentId) }
  async openAttempt(studentId: string, activity: Activity) { return this.repository.openAttempt(studentId, activity) }
  async saveAttempt(attempt: ActivityAttempt): Promise<SavedAttempt> { return { attempt: this.repository.saveAttempt(attempt), remoteState: 'local' } }
  async createActivity(activity: Activity, classId?: string) { return this.repository.createActivity(activity, classId) }
  async dashboard() { return this.repository.dashboard() }
  async ranking(classId: string, activityId: string) { return this.repository.ranking(classId, activityId) }
  async retryPending() { return 0 }
}

export async function createPlatformRepository(): Promise<PlatformRepository> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      const repository = new SupabasePlatformRepository(supabase)
      await repository.retryPending()
      return repository
    }
  }
  return new LocalRepositoryAdapter(new LocalPlatformRepository({ demoMode: true }))
}
