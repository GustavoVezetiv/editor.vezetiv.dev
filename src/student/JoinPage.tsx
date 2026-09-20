import { useState } from 'react'

interface JoinPageProps { onJoin: (classCode: string, studentCode: string, displayName: string) => Promise<void>; error?: string; mode: 'local' | 'supabase' }

export function JoinPage({ onJoin, error, mode }: JoinPageProps) {
  const [classCode, setClassCode] = useState('DEMO')
  const [studentCode, setStudentCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [joining, setJoining] = useState(false)
  return <main className="entry-page"><section className="entry-card"><div className="brand"><span className="brand-mark">V</span>Editor Vezetiv</div><h1>Entrar na atividade</h1><p>Use o código da turma e sua identificação definida pelo professor.</p><form onSubmit={(event) => { event.preventDefault(); if (!studentCode.trim()) return; setJoining(true); void onJoin(classCode, studentCode, displayName).finally(() => setJoining(false)) }}><label>Código da turma<input value={classCode} onChange={(event) => setClassCode(event.target.value)} required /></label><label>Sua identificação<input value={studentCode} onChange={(event) => setStudentCode(event.target.value)} required placeholder="Ex.: 20261234" /></label><label>Como quer ser chamado?<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Opcional" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={joining}>{joining ? 'Entrando…' : 'Entrar'}</button></form><p className="entry-help">{mode === 'local' ? <>Demonstração local: use a turma <strong>DEMO</strong>. Não é necessário e-mail.</> : 'Modo Supabase: a turma e o aluno precisam existir e estar associados à sessão autenticada.'}</p></section></main>
}
