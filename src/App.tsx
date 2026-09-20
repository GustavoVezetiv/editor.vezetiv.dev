import { useCallback, useEffect, useState } from 'react'
import { ActivityWorkspace } from './activity/ActivityWorkspace'
import { createPlatformRepository, type PlatformRepository } from './services/platformRepository'
import { JoinPage } from './student/JoinPage'
import { StudentHome } from './student/StudentHome'
import { TeacherPage } from './teacher/TeacherPage'
import type { Activity } from './types/activity'
import type { ActivityAttempt, RankedStudent, Student, TeacherDashboard } from './types/platform'

const SESSION_KEY = 'editor-vezetiv:student-id'
type Route = 'join' | 'home' | 'activity' | 'teacher'
const routeForPath = (): Route => location.pathname === '/join' ? 'join' : location.pathname.startsWith('/teacher') ? 'teacher' : location.pathname.startsWith('/activity/') ? 'activity' : 'home'
const activitySlugFromPath = () => location.pathname.split('/')[2]
const emptyDashboard = (): TeacherDashboard => ({ classes: [], students: [], activities: [], classActivities: [], attempts: [], averageScore: 0, completedAttempts: 0 })

function App() {
  const [route, setRoute] = useState<Route>(routeForPath)
  const [repository, setRepository] = useState<PlatformRepository | null>(null)
  const [student, setStudent] = useState<Student>()
  const [activities, setActivities] = useState<Activity[]>([])
  const [attempts, setAttempts] = useState<ActivityAttempt[]>([])
  const [ranking, setRanking] = useState<RankedStudent[]>([])
  const [dashboard, setDashboard] = useState<TeacherDashboard>(emptyDashboard)
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null)
  const [activeAttempt, setActiveAttempt] = useState<ActivityAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useCallback((next: Route, path: string) => { history.pushState({}, '', path); setRoute(next) }, [])

  useEffect(() => {
    let current = true
    const initialize = async () => {
      try {
        const nextRepository = await createPlatformRepository()
        const nextDashboard = await nextRepository.dashboard()
        const sessionId = localStorage.getItem(SESSION_KEY)
        const savedStudent = sessionId ? await nextRepository.getStudent(sessionId) : undefined
        const nextActivities = savedStudent ? await nextRepository.listActivities(savedStudent) : []
        const featured = nextActivities.find((activity) => activity.isFeatured)
        const nextRanking = savedStudent && featured ? await nextRepository.ranking(savedStudent.classId, featured.id) : []
        if (!current) return
        setRepository(nextRepository)
        setDashboard(nextDashboard)
        setStudent(savedStudent)
        setActivities(nextActivities)
        setAttempts(savedStudent ? nextDashboard.attempts.filter((attempt) => attempt.studentId === savedStudent.id) : [])
        setRanking(nextRanking)
        if (sessionId && !savedStudent) localStorage.removeItem(SESSION_KEY)
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a plataforma.')
      } finally {
        if (current) setLoading(false)
      }
    }
    void initialize()
    return () => { current = false }
  }, [])

  useEffect(() => {
    const updateRoute = () => setRoute(routeForPath())
    addEventListener('popstate', updateRoute)
    return () => removeEventListener('popstate', updateRoute)
  }, [])

  useEffect(() => {
    if (!repository || !student || route !== 'activity') return
    let current = true
    const openFromRoute = async () => {
      const activity = activities.find((item) => item.slug === activitySlugFromPath())
      if (!activity) { navigate('home', '/student'); return }
      try {
        const attempt = await repository.openAttempt(student.id, activity)
        if (!current) return
        setActiveActivity(activity)
        setActiveAttempt(attempt)
        setAttempts((items) => [...items.filter((item) => item.id !== attempt.id), attempt])
      } catch (cause) { if (current) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a atividade.') }
    }
    void openFromRoute()
    return () => { current = false }
  }, [activities, navigate, repository, route, student])

  const join = async (classCode: string, studentCode: string, displayName: string) => {
    if (!repository) return
    setError('')
    try {
      const joined = await repository.join(classCode, studentCode, displayName)
      const [nextActivities, nextDashboard] = await Promise.all([repository.listActivities(joined), repository.dashboard()])
      const featured = nextActivities.find((activity) => activity.isFeatured)
      localStorage.setItem(SESSION_KEY, joined.id)
      setStudent(joined)
      setActivities(nextActivities)
      setDashboard(nextDashboard)
      setAttempts(nextDashboard.attempts.filter((attempt) => attempt.studentId === joined.id))
      setRanking(featured ? await repository.ranking(joined.classId, featured.id) : [])
      navigate('home', '/student')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível entrar na turma.') }
  }

  const openActivity = async (activity: Activity) => {
    if (!student || !repository) { navigate('join', '/join'); return }
    setError('')
    try {
      const attempt = await repository.openAttempt(student.id, activity)
      setActiveActivity(activity)
      setActiveAttempt(attempt)
      setAttempts((items) => [...items.filter((item) => item.id !== attempt.id), attempt])
      navigate('activity', `/activity/${activity.slug}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a atividade.') }
  }

  const saveAttempt = useCallback(async (attempt: ActivityAttempt) => {
    if (!repository) return { attempt, remoteState: 'blocked' as const }
    const saved = await repository.saveAttempt(attempt)
    setActiveAttempt(saved.attempt)
    setAttempts((items) => [...items.filter((item) => item.id !== saved.attempt.id), saved.attempt])
    const featured = activities.find((activity) => activity.isFeatured)
    if (student && featured) setRanking(await repository.ranking(student.classId, featured.id))
    return saved
  }, [activities, repository, student])

  const createActivity = async (activity: Activity, classId: string) => {
    if (!repository) return
    await repository.createActivity(activity, classId)
    const nextDashboard = await repository.dashboard()
    setDashboard(nextDashboard)
    if (student) setActivities(await repository.listActivities(student))
  }

  const leave = () => { localStorage.removeItem(SESSION_KEY); setStudent(undefined); setActivities([]); setAttempts([]); setRanking([]); navigate('join', '/join') }
  const backHome = () => navigate('home', '/student')

  if (loading) return <main className="entry-page"><section className="entry-card"><h1>Carregando Editor Vezetiv…</h1><p>Preparando turma, atividades e documentos.</p></section></main>
  if (route === 'teacher') return <TeacherPage dashboard={dashboard} onCreateActivity={createActivity} onBack={backHome} />
  if (!student || route === 'join') return <JoinPage onJoin={join} error={error} mode={repository?.mode ?? 'local'} />
  if (route === 'activity' && activeActivity && activeAttempt) return <ActivityWorkspace key={activeAttempt.id} activity={activeActivity} student={student} initialAttempt={activeAttempt} onSaveAttempt={saveAttempt} onBack={backHome} />
  if (route === 'activity') return <main className="entry-page"><section className="entry-card"><h1>Abrindo atividade…</h1><p>{error || 'Recuperando seu documento salvo.'}</p></section></main>
  return <><StudentHome student={student} activities={activities} attempts={attempts} ranking={ranking} onOpen={(activity) => { void openActivity(activity) }} onLeave={leave} /><a className="teacher-link" href="/teacher" onClick={(event) => { event.preventDefault(); navigate('teacher', '/teacher') }}>Painel docente · {repository?.mode === 'supabase' ? 'Supabase' : 'demo local'}</a></>
}

export default App
