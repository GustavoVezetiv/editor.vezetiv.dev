import { useCallback, useEffect, useState } from 'react'
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
const routeForPath = (): Route => location.pathname === '/join' ? 'join' : location.pathname.startsWith('/teacher') ? 'teacher' : location.pathname.startsWith('/activity/') ? 'activity' : 'home'
const activitySlugFromPath = () => location.pathname.split('/')[2]

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
  const navigate = useCallback((next: Route, path: string) => { history.pushState({}, '', path); setRoute(next) }, [])
  const dashboard = platformRepository.dashboard()

  useEffect(() => {
    const updateRoute = () => setRoute(routeForPath())
    addEventListener('popstate', updateRoute)
    return () => removeEventListener('popstate', updateRoute)
  }, [])

  useEffect(() => {
    if (!student || route !== 'activity') return
    const timeout = window.setTimeout(() => {
      const activity = activities.find((item) => item.slug === activitySlugFromPath())
      if (!activity) { navigate('home', '/'); return }
      const attempt = platformRepository.openAttempt(student.id, activity)
      setActiveActivity(activity)
      setActiveAttempt(attempt)
      setAttempts((current) => [...current.filter((item) => item.id !== attempt.id), attempt])
    })
    return () => window.clearTimeout(timeout)
  }, [activities, navigate, route, student])

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
  const saveAttempt = useCallback(async (attempt: ActivityAttempt) => {
    const saved = await platformRepository.saveAttempt(attempt)
    setActiveAttempt(saved.attempt)
    setAttempts((current) => [...current.filter((item) => item.id !== saved.attempt.id), saved.attempt])
    return saved
  }, [])
  const leave = () => { localStorage.removeItem(SESSION_KEY); setStudent(undefined); setAttempts([]); navigate('join', '/join') }
  const backHome = () => navigate('home', '/')

  if (route === 'teacher') return <TeacherPage dashboard={dashboard} onCreateActivity={(activity) => { platformRepository.createActivity(activity); setActivities(platformRepository.listActivities()) }} onBack={backHome} />
  if (!student || route === 'join') return <JoinPage onJoin={join} />
  if (route === 'activity' && activeActivity && activeAttempt) return <ActivityWorkspace key={activeAttempt.id} activity={activeActivity} student={student} initialAttempt={activeAttempt} onSaveAttempt={saveAttempt} onBack={backHome} />
  if (route === 'activity') return <main className="entry-page"><section className="entry-card"><h1>Abrindo atividade…</h1><p>Recuperando seu documento salvo.</p></section></main>

  const featured = activities.find((activity) => activity.isFeatured)
  return <><StudentHome student={student} activities={activities} attempts={attempts} ranking={featured ? platformRepository.ranking(featured.id) : []} onOpen={openActivity} onLeave={leave} /><a className="teacher-link" href="/teacher" onClick={(event) => { event.preventDefault(); navigate('teacher', '/teacher') }}>Painel docente {isSupabaseConfigured ? '· Supabase configurado' : '· modo local'}</a></>
}

export default App
