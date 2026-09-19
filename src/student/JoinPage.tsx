import { useState } from 'react'

interface JoinPageProps { onJoin: (classCode: string, studentCode: string, displayName: string) => void }

export function JoinPage({ onJoin }: JoinPageProps) {
  const [classCode, setClassCode] = useState('DEMO')
  const [studentCode, setStudentCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  return <main className="entry-page"><section className="entry-card"><div className="brand"><span className="brand-mark">V</span>Editor Vezetiv</div><h1>Entrar na atividade</h1><p>Use o código da turma e sua identificação definida pelo professor.</p><form onSubmit={(event) => { event.preventDefault(); if (studentCode.trim()) onJoin(classCode, studentCode, displayName) }}><label>Código da turma<input value={classCode} onChange={(event) => setClassCode(event.target.value)} required /></label><label>Sua identificação<input value={studentCode} onChange={(event) => setStudentCode(event.target.value)} required placeholder="Ex.: 20261234" /></label><label>Como quer ser chamado?<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Opcional" /></label><button className="primary-button" type="submit">Entrar</button></form><p className="entry-help">Demonstração local: use a turma <strong>DEMO</strong>. Não é necessário e-mail.</p></section></main>
}
