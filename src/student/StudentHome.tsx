import type { Activity } from '../types/activity'
import type { ActivityAttempt, RankedStudent, Student } from '../types/platform'

interface StudentHomeProps { student: Student; activities: Activity[]; attempts: ActivityAttempt[]; ranking: RankedStudent[]; onOpen: (activity: Activity) => void; onLeave: () => void }
const label = (status?: ActivityAttempt['status']) => status === 'completed' ? 'Concluída' : status === 'in-progress' ? 'Em andamento' : 'Não iniciada'
const publicName = (name: string) => { const [first, ...rest] = name.trim().split(/\s+/); return `${first} ${rest[0] ? `${rest[0][0]}.` : ''}`.trim() }

export function StudentHome({ student, activities, attempts, ranking, onOpen, onLeave }: StudentHomeProps) {
  const featured = activities.find((activity) => activity.isFeatured)
  const others = activities.filter((activity) => activity.id !== featured?.id)
  const card = (activity: Activity, featuredCard = false) => { const attempt = attempts.find((item) => item.activityId === activity.id); return <article className={`activity-card ${featuredCard ? 'featured' : ''}`} key={activity.id}><span>{featuredCard ? 'Atividade da semana' : 'Atividade'}</span><h2>{activity.title}</h2><p>{activity.description}</p><div className="card-meta"><strong>{label(attempt?.status)}</strong><span>{attempt?.currentScore ?? 0} / {activity.scoring.totalPoints} pontos</span></div><button className="primary-button" onClick={() => onOpen(activity)}>{attempt ? 'Continuar' : 'Iniciar'}</button></article> }
  return <main className="home-page"><header className="home-header"><div className="brand"><span className="brand-mark">V</span>Editor Vezetiv</div><div><span>Olá, {student.displayName}</span><button className="link-button" onClick={onLeave}>Sair</button></div></header><section className="home-content">{featured && <section><h1>Aprenda praticando</h1>{card(featured, true)}</section>}<section><h2>Outras atividades</h2><div className="activity-grid">{others.map((activity) => card(activity))}</div></section><section className="ranking-card"><h2>Ranking da atividade da semana</h2>{ranking.slice(0, 5).map((entry) => <p key={entry.student.id}><strong>{entry.position}º</strong> {publicName(entry.student.displayName)} <span>{entry.score} pontos</span></p>)}{ranking.find((entry) => entry.student.id === student.id) && <p className="own-ranking">Sua posição: {ranking.find((entry) => entry.student.id === student.id)?.position}º</p>}</section></section></main>
}
