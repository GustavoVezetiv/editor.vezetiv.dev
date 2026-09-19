import { useState } from 'react'
import { ActivityWorkspace } from './activity/ActivityWorkspace'
import { platformRepository } from './services/platformRepository'
import { isSupabaseConfigured } from './services/supabase'
import { JoinPage } from './student/JoinPage'
import { StudentHome } from './student/StudentHome'
import { TeacherPage } from './teacher/TeacherPage'
import type { Activity } from './types/activity'
import type { ActivityAttempt, Student } from './types/platform'

const SESSION_KEY = 'editor-vezetiv:student-id'
type Route = 'join' | 'home' | 'activity' | 'teacher'
const routeForPath = (): Route => location.pathname === '/join' ? 'join' : location.pathname === '/teacher' ? 'teacher' : location.pathname.startsWith('/activity/') ? 'activity' : 'home'

function App() {
  const [route, setRoute] = useState<Route>(routeForPath)
  const [student, setStudent] = useState<Student | undefined>(() => {
    const id = localStorage.getItem(SESSION_KEY)
    return id ? platformRepository.getStudent(id) : undefined
  })
  const [activities, setActivities] = useState(() => platformRepository.listActivities())
  const [attempts, setAttempts] = useState<ActivityAttempt[]>(() => student ? platformRepository.dashboard().attempts.filter((attempt) => attempt.studentId === student.id) : [])
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null)
  const [activeAttempt, setActiveAttempt] = useState<ActivityAttempt | null>(null)
  const navigate = (next: Route, path: string) => { history.pushState({}, '', path); setRoute(next) }
  const dashboard = platformRepository.dashboard()

  const join = (classCode: string, studentCode: string, displayName: string) => {
    const joined = platformRepository.join(classCode, studentCode, displayName)
    localStorage.setItem(SESSION_KEY, joined.id)
    setStudent(joined)
    setAttempts(platformRepository.dashboard().attempts.filter((attempt) => attempt.studentId === joined.id))
    navigate('home', '/')
  }
  const openActivity = (activity: Activity) => {
    if (!student) { navigate('join', '/join'); return }
    const attempt = platformRepository.openAttempt(student.id, activity)
    setActiveActivity(activity); setActiveAttempt(attempt)
    setAttempts((current) => [...current.filter((item) => item.id !== attempt.id), attempt])
    navigate('activity', `/activity/${activity.slug}`)
  }
  const saveAttempt = (attempt: ActivityAttempt) => {
    const saved = platformRepository.saveAttempt(attempt)
    setActiveAttempt(saved)
    setAttempts((current) => [...current.filter((item) => item.id !== saved.id), saved])
  }
  const leave = () => { localStorage.removeItem(SESSION_KEY); setStudent(undefined); setAttempts([]); navigate('join', '/join') }
  const backHome = () => navigate('home', '/')

  if (route === 'teacher') return <TeacherPage dashboard={dashboard} onCreateActivity={(activity) => { platformRepository.createActivity(activity); setActivities(platformRepository.listActivities()) }} onBack={backHome} />
  if (!student || route === 'join') return <JoinPage onJoin={join} />
  if (route === 'activity' && activeActivity && activeAttempt) return <ActivityWorkspace key={activeAttempt.id} activity={activeActivity} student={student} initialAttempt={activeAttempt} onSaveAttempt={saveAttempt} onBack={backHome} />

  const featured = activities.find((activity) => activity.isFeatured)
  return <><StudentHome student={student} activities={activities} attempts={attempts} ranking={featured ? platformRepository.ranking(featured.id) : []} onOpen={openActivity} onLeave={leave} /><a className="teacher-link" href="/teacher" onClick={(event) => { event.preventDefault(); navigate('teacher', '/teacher') }}>Painel docente {isSupabaseConfigured ? '· Supabase configurado' : '· modo local'}</a></>
}

export default App
