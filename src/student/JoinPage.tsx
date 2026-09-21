import { useState } from 'react'

interface JoinPageProps { onJoin: (classCode: string, accessCode: string, displayName: string) => Promise<void>; onDemoTeacher: () => void; onTeacherLogin: () => void; error?: string; mode: 'demo' | 'supabase' }

export function JoinPage({ onJoin, onDemoTeacher, onTeacherLogin, error, mode }: JoinPageProps) {
  const params = new URLSearchParams(location.search)
  const [classCode, setClassCode] = useState(params.get('class') ?? (mode === 'demo' ? 'DEMO' : ''))
  const [accessCode, setAccessCode] = useState(params.get('code') ?? '')
  const [displayName, setDisplayName] = useState('')
  const [joining, setJoining] = useState(false)
  return <main className="entry-page"><section className="entry-card"><div className="brand"><span className="brand-mark">V</span>Editor Vezetiv</div>{mode === 'demo' ? <p className="demo-badge">Modo de demonstração</p> : null}<h1>Entrar como aluno</h1><p>Use o código da turma e o código de acesso individual entregue pelo professor.</p><form onSubmit={(event) => { event.preventDefault(); if (!accessCode.trim()) return; setJoining(true); void onJoin(classCode, accessCode, displayName).finally(() => setJoining(false)) }}><label>Código da turma<input value={classCode} onChange={(event) => setClassCode(event.target.value)} required autoComplete="off" /></label><label>Código de acesso individual<input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} required autoComplete="one-time-code" placeholder="Ex.: A7K9-P4Q2" /></label>{mode === 'demo' ? <label>Como quer ser chamado?<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Opcional para novo aluno demo" /></label> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-button" type="submit" disabled={joining}>{joining ? 'Entrando…' : 'Entrar como aluno'}</button></form><p className="entry-help">O link pode preencher os códigos, mas a entrada nunca acontece automaticamente. Quem tiver o link poderá tentar usar esse acesso.</p><div className="entry-actions">{mode === 'demo' ? <button className="link-button" onClick={onDemoTeacher}>Ver demonstração do professor</button> : <button className="link-button" onClick={onTeacherLogin}>Login do professor</button>}</div></section></main>
}
