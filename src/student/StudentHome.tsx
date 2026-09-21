import type { Activity } from '../types/activity'
import type { ActivityAttempt, AssignedActivity, RankedStudent, Student } from '../types/platform'

interface StudentHomeProps { student: Student; activities: AssignedActivity[]; attempts: ActivityAttempt[]; ranking: RankedStudent[]; onOpen: (activity: Activity) => void; onLeave: () => void }
const label = (status?: ActivityAttempt['status']) => status === 'completed' ? 'Concluída' : status === 'in-progress' ? 'Em andamento' : 'Não iniciada'
const publicName = (name: string) => { const [first, ...rest] = name.trim().split(/\s+/); return `${first} ${rest[0] ? `${rest[0][0]}.` : ''}`.trim() }

export function StudentHome({ student, activities, attempts, ranking, onOpen, onLeave }: StudentHomeProps) {
  const featured = activities.find((item) => item.assignment.isFeatured)
  const others = activities.filter((item) => item.assignment.id !== featured?.assignment.id)
  const card = (assigned: AssignedActivity, featuredCard = false) => { const { activity } = assigned; const attempt = attempts.find((item) => item.activityId === activity.id); return <article className={`activity-card ${featuredCard ? 'featured' : ''}`} key={activity.id}><span>{featuredCard ? 'Atividade da semana' : 'Atividade'}</span><h2>{activity.title}</h2><p>{activity.description}</p><div className="card-meta"><strong>{label(attempt?.status)}</strong><span>{attempt?.currentScore ?? 0} / {activity.scoring.totalPoints} pontos</span></div><button className="primary-button" onClick={() => onOpen(activity)}>{attempt?.status === 'completed' ? 'Visualizar' : attempt ? 'Continuar' : 'Iniciar'}</button></article> }
  const ownRanking = ranking.find((entry) => entry.isCurrentStudent)
  return <main className="home-page"><header className="home-header"><div className="brand"><span className="brand-mark">V</span>Editor Vezetiv</div><div><span>Olá, {student.displayName}</span><button className="link-button" onClick={onLeave}>Sair</button></div></header><section className="home-content">{featured ? <section><h1>Aprenda praticando</h1>{card(featured, true)}</section> : <section><h1>Aprenda praticando</h1><p className="empty-state">Sua turma ainda não possui uma atividade da semana disponível.</p></section>}<section><h2>Outras atividades</h2><div className="activity-grid">{others.map((activity) => card(activity))}</div></section>{featured ? <section className="ranking-card"><h2>Ranking da atividade da semana</h2>{ranking.filter((entry) => entry.position <= 5).map((entry) => <p key={`${entry.position}-${entry.displayName}`}><strong>{entry.position}º</strong> {publicName(entry.displayName)} <span>{entry.score} pontos</span></p>)}{ownRanking ? <p className="own-ranking">Sua posição: {ownRanking.position}º</p> : null}</section> : null}</section></main>
}
