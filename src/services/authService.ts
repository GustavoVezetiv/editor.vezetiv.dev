import type { SupabaseClient } from '@supabase/supabase-js'
import type { Actor, Student } from '../types/platform'
import type { PlatformRepository } from './platformRepository'
import { appMode, supabase } from './supabase'

const DEMO_ROLE_KEY = 'editor-vezetiv:demo-role'
const DEMO_STUDENT_KEY = 'editor-vezetiv:demo-student-id'

type ActorRow = { role?: string; user_id?: string; student?: Record<string, unknown> }
const studentFromRpc = (row: Record<string, unknown>): Student => ({ id: String(row.id), classId: String(row.class_id), code: row.code ? String(row.code) : undefined, displayName: String(row.display_name), createdAt: String(row.created_at) })

export class AuthService {
  constructor(private readonly repository: PlatformRepository, private readonly client: SupabaseClient | null = supabase) {}

  async getActor(): Promise<Actor> {
    if (appMode === 'demo') {
      const role = localStorage.getItem(DEMO_ROLE_KEY)
      if (role === 'teacher') return { role: 'teacher', userId: 'teacher-demo' }
      const studentId = localStorage.getItem(DEMO_STUDENT_KEY)
      const student = studentId ? await this.repository.getStudent(studentId) : undefined
      return student ? { role: 'student', student } : { role: 'anonymous' }
    }
    if (!this.client) return { role: 'anonymous' }
    const { data: session } = await this.client.auth.getSession()
    if (!session.session) return { role: 'anonymous' }
    const { data, error } = await this.client.rpc('get_current_actor')
    if (error) throw new Error(error.message)
    const actor = data as ActorRow | null
    if (actor?.role === 'teacher') return { role: 'teacher', userId: String(actor.user_id) }
    if (actor?.role === 'student' && actor.student) return { role: 'student', student: studentFromRpc(actor.student) }
    return { role: 'anonymous' }
  }

  async joinStudent(classCode: string, accessCode: string, displayName?: string): Promise<Student> {
    if (appMode === 'demo') {
      const student = await this.repository.join(classCode, accessCode, displayName)
      localStorage.setItem(DEMO_ROLE_KEY, 'student'); localStorage.setItem(DEMO_STUDENT_KEY, student.id)
      return student
    }
    if (!this.client) throw new Error('Supabase não está configurado.')
    let { data: session } = await this.client.auth.getSession()
    if (!session.session) {
      const signed = await this.client.auth.signInAnonymously()
      if (signed.error) throw new Error(signed.error.message)
      session = { session: signed.data.session }
    }
    if (!session.session?.user.is_anonymous) throw new Error('Saia da conta de professor antes de entrar como aluno.')
    const { data, error } = await this.client.rpc('join_student', { p_class_code: classCode.trim().toUpperCase(), p_access_code: accessCode.trim().toUpperCase() })
    if (error) throw new Error(error.message)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new Error('Código de turma ou acesso inválido.')
    return studentFromRpc(row as Record<string, unknown>)
  }

  enterDemoTeacher(): void { if (appMode !== 'demo') return; localStorage.setItem(DEMO_ROLE_KEY, 'teacher'); localStorage.removeItem(DEMO_STUDENT_KEY) }
  async requestTeacherLink(email: string): Promise<void> { if (!this.client) throw new Error('Login docente disponível apenas no modo Supabase.'); const { error } = await this.client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/teacher` } }); if (error) throw new Error(error.message) }
  async signOut(): Promise<void> { localStorage.removeItem(DEMO_ROLE_KEY); localStorage.removeItem(DEMO_STUDENT_KEY); if (this.client) { const { error } = await this.client.auth.signOut(); if (error) throw new Error(error.message) } }
}
