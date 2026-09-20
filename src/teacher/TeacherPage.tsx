import { useMemo, useState } from 'react'
import type { Activity } from '../types/activity'
import type { ActivityAttempt, TeacherDashboard } from '../types/platform'
import type { PedagogicalEvent } from '../events/pedagogicalEvents'
import { ActivityBuilder } from './ActivityBuilder'
import { ReadOnlyDocument } from './ReadOnlyDocument'

interface TeacherPageProps { dashboard: TeacherDashboard; onCreateActivity: (activity: Activity, classId: string) => Promise<void>; onBack: () => void }

const eventLabel = (event: PedagogicalEvent) => ({
  activity_started: 'Iniciou a atividade', paste_blocked: 'Tentou colar conteúdo', document_created: 'Criou um documento', document_renamed: 'Renomeou um documento', document_deleted: 'Excluiu um documento', format_applied: `Aplicou ${String(event.metadata.tool ?? 'formatação')}`, hint_opened: 'Abriu uma dica', verification_requested: 'Solicitou verificação', verification_completed: `Concluiu verificação (${String(event.metadata.score ?? 0)} pontos)`, requirement_passed: 'Concluiu requisito', activity_completed: 'Concluiu a atividade', preset_changed: 'Alterou o padrão do documento',
}[event.type])

export function TeacherPage({ dashboard, onCreateActivity, onBack }: TeacherPageProps) {
  const [selectedId, setSelectedId] = useState(dashboard.attempts[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | ActivityAttempt['status']>('all')
  const selected = dashboard.attempts.find((attempt) => attempt.id === selectedId)
  const student = selected && dashboard.students.find((item) => item.id === selected.studentId)
  const activity = selected && dashboard.activities.find((item) => item.id === selected.activityId)
  const attempts = useMemo(() => dashboard.attempts.filter((attempt) => {
    const name = dashboard.students.find((item) => item.id === attempt.studentId)?.displayName ?? ''
    const title = dashboard.activities.find((item) => item.id === attempt.activityId)?.title ?? ''
    return (status === 'all' || attempt.status === status) && `${name} ${title}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  }), [dashboard, query, status])
  const stats = [{ label: 'Alunos participantes', value: dashboard.students.length }, { label: 'Atividades', value: dashboard.activities.length }, { label: 'Média de pontuação', value: dashboard.averageScore }, { label: 'Concluídas', value: dashboard.completedAttempts }]
  return <main className="teacher-page"><header className="home-header"><div className="brand"><span className="brand-mark">V</span>Painel docente</div><button className="link-button" onClick={onBack}>Área do aluno</button></header><section className="teacher-content"><h1>Acompanhamento de aprendizagem</h1><p className="teacher-intro">Uma visão de aula baseada em tentativas, verificações e eventos pedagógicos — sem editar o trabalho do estudante.</p><div className="stats-grid">{stats.map((stat) => <article key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></article>)}</div><div className="teacher-grid"><section><h2>Tentativas</h2><div className="teacher-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno ou atividade" aria-label="Buscar tentativas" /><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filtrar por status"><option value="all">Todos os status</option><option value="in-progress">Em andamento</option><option value="completed">Concluídas</option></select></div>{attempts.length ? attempts.map((attempt) => <button className={`attempt-row ${selected?.id === attempt.id ? 'is-selected' : ''}`} key={attempt.id} onClick={() => setSelectedId(attempt.id)}><span>{dashboard.students.find((item) => item.id === attempt.studentId)?.displayName}<small>{dashboard.activities.find((item) => item.id === attempt.activityId)?.title} · {attempt.status === 'completed' ? 'Concluída' : 'Em andamento'}</small></span><strong>{attempt.currentScore}</strong></button>) : <p className="empty-state">Nenhuma tentativa encontrada para este filtro.</p>}</section><section className="attempt-detail"><h2>Detalhe do aluno</h2>{selected && student && activity ? <><p><strong>{student.displayName}</strong> · {student.code}</p><p>{activity.title} · {selected.status === 'completed' ? 'Concluída' : 'Em andamento'} · {selected.currentScore} pontos</p><h3>Documento atual</h3><ReadOnlyDocument document={selected.documents.find((item) => item.id === selected.activeDocumentId) ?? selected.documents[0]} /><h3>Verificações</h3>{selected.verificationRuns.length ? selected.verificationRuns.map((run) => <p key={run.id}>{new Date(run.createdAt).toLocaleString('pt-BR')} — {run.score} pontos</p>) : <p className="empty-state">Ainda não houve verificação registrada.</p>}<h3>Timeline pedagógica</h3><ol className="event-timeline">{selected.events.slice(-12).reverse().map((event) => <li key={event.id}><strong>{eventLabel(event)}</strong><small>{new Date(event.timestamp).toLocaleString('pt-BR')}</small></li>)}</ol></> : <p className="empty-state">Selecione uma tentativa para ver o acompanhamento.</p>}</section></div><ActivityBuilder activities={dashboard.activities} classrooms={dashboard.classes} onCreate={onCreateActivity} /></section></main>
}
