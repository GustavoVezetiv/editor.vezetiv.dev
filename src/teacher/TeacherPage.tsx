import { useMemo, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { Activity, ActivityStatus } from '../types/activity'
import type { ActivityAttempt, TeacherDashboard } from '../types/platform'
import type { PedagogicalEvent } from '../events/pedagogicalEvents'

interface TeacherPageProps { dashboard: TeacherDashboard; onCreateActivity: (activity: Activity) => void; onBack: () => void }

const eventLabel = (event: PedagogicalEvent) => ({
  activity_started: 'Iniciou a atividade', paste_blocked: 'Tentou colar conteúdo', document_created: 'Criou um documento', document_renamed: 'Renomeou um documento', document_deleted: 'Excluiu um documento', format_applied: `Aplicou ${String(event.metadata.tool ?? 'formatação')}`, hint_opened: 'Abriu uma dica', verification_requested: 'Solicitou verificação', verification_completed: `Concluiu verificação (${String(event.metadata.score ?? 0)} pontos)`, requirement_passed: 'Concluiu requisito', activity_completed: 'Concluiu a atividade', preset_changed: 'Alterou o padrão do documento',
}[event.type])

function documentText(attempt: ActivityAttempt): string {
  const document = attempt.documents.find((item) => item.id === attempt.activeDocumentId) ?? attempt.documents[0]
  const collect = (node: JSONContent): string => node.type === 'text' ? node.text ?? '' : (node.content ?? []).map(collect).join('')
  return document ? collect(document.content) : 'Nenhum documento salvo.'
}

export function TeacherPage({ dashboard, onCreateActivity, onBack }: TeacherPageProps) {
  const [selected, setSelected] = useState<ActivityAttempt | null>(dashboard.attempts[0] ?? null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | ActivityAttempt['status']>('all')
  const [title, setTitle] = useState('Nova atividade')
  const [description, setDescription] = useState('Prática guiada criada pelo professor.')
  const [publication, setPublication] = useState<ActivityStatus>('draft')
  const student = selected && dashboard.students.find((item) => item.id === selected.studentId)
  const activity = selected && dashboard.activities.find((item) => item.id === selected.activityId)
  const attempts = useMemo(() => dashboard.attempts.filter((attempt) => {
    const name = dashboard.students.find((student) => student.id === attempt.studentId)?.displayName ?? ''
    return (status === 'all' || attempt.status === status) && `${name} ${dashboard.activities.find((item) => item.id === attempt.activityId)?.title ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  }), [dashboard, query, status])
  const stats = useMemo(() => [{ label: 'Alunos participantes', value: dashboard.students.length }, { label: 'Atividades', value: dashboard.activities.length }, { label: 'Média de pontuação', value: dashboard.averageScore }, { label: 'Concluídas', value: dashboard.completedAttempts }], [dashboard])
  const create = (base = dashboard.activities[0]) => {
    if (!base || !title.trim()) return
    const slug = title.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    onCreateActivity({ ...base, id: `atividade-${crypto.randomUUID()}`, slug: `${slug}-${Date.now().toString().slice(-4)}`, title: title.trim(), description: description.trim() || 'Prática guiada criada pelo professor.', status: publication, isFeatured: false })
  }
  const duplicate = (source: Activity) => { setTitle(`${source.title} (cópia)`); setDescription(source.description); setPublication('draft') }
  return <main className="teacher-page"><header className="home-header"><div className="brand"><span className="brand-mark">V</span>Painel docente</div><button className="link-button" onClick={onBack}>Área do aluno</button></header><section className="teacher-content"><h1>Acompanhamento de aprendizagem</h1><p className="teacher-intro">Uma visão de aula baseada em tentativas, verificações e eventos pedagógicos — sem editar o trabalho do estudante.</p><div className="stats-grid">{stats.map((stat) => <article key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></article>)}</div><div className="teacher-grid"><section><h2>Tentativas</h2><div className="teacher-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno ou atividade" aria-label="Buscar tentativas" /><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filtrar por status"><option value="all">Todos os status</option><option value="in-progress">Em andamento</option><option value="completed">Concluídas</option></select></div>{attempts.length ? attempts.map((attempt) => <button className={`attempt-row ${selected?.id === attempt.id ? 'is-selected' : ''}`} key={attempt.id} onClick={() => setSelected(attempt)}><span>{dashboard.students.find((item) => item.id === attempt.studentId)?.displayName}<small>{dashboard.activities.find((item) => item.id === attempt.activityId)?.title} · {attempt.status === 'completed' ? 'Concluída' : 'Em andamento'}</small></span><strong>{attempt.currentScore}</strong></button>) : <p className="empty-state">Nenhuma tentativa encontrada para este filtro.</p>}</section><section className="attempt-detail"><h2>Detalhe do aluno</h2>{selected && student && activity ? <><p><strong>{student.displayName}</strong> · {student.code}</p><p>{activity.title} · {selected.status === 'completed' ? 'Concluída' : 'Em andamento'} · {selected.currentScore} pontos</p><h3>Documento atual</h3><article className="readonly-document" aria-label="Documento somente leitura">{documentText(selected) || 'Documento vazio.'}</article><h3>Verificações</h3>{selected.verificationRuns.length ? selected.verificationRuns.map((run) => <p key={run.id}>{new Date(run.createdAt).toLocaleString('pt-BR')} — {run.score} pontos</p>) : <p className="empty-state">Ainda não houve verificação registrada.</p>}<h3>Timeline pedagógica</h3><ol className="event-timeline">{selected.events.slice(-12).reverse().map((event) => <li key={event.id}><strong>{eventLabel(event)}</strong><small>{new Date(event.timestamp).toLocaleString('pt-BR')}</small></li>)}</ol></> : <p className="empty-state">Selecione uma tentativa para ver o acompanhamento.</p>}</section></div><section className="creator-card"><h2>Criador de atividades</h2><p>Crie uma atividade como rascunho ou publique-a. Cada atividade nasce de uma configuração validável existente, com requisitos, dicas e ferramentas definidos no mesmo modelo.</p><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>Status<select value={publication} onChange={(event) => setPublication(event.target.value as ActivityStatus)}><option value="draft">Rascunho</option><option value="published">Publicada</option></select></label><button className="primary-button" onClick={() => create()}>Criar atividade</button><div className="activity-management"><h3>Atividades existentes</h3>{dashboard.activities.map((item) => <div key={item.id}><span>{item.title} <small>{item.status === 'published' ? 'Publicada' : 'Rascunho'}</small></span><button className="link-button" onClick={() => duplicate(item)}>Duplicar</button></div>)}</div></section></section></main>
}
