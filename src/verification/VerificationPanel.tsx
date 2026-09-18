import type { VerificationMode } from '../types/activity'
import type { CheckResult } from './verifyActivity'

interface VerificationPanelProps {
  mode: VerificationMode
  results: CheckResult[] | null
  hasUnverifiedChanges: boolean
  onVerify: () => void
}

export function VerificationPanel({ mode, results, hasUnverifiedChanges, onVerify }: VerificationPanelProps) {
  const completed = results?.filter((result) => result.passed).length ?? 0

  return (
    <section className="verification-panel" aria-labelledby="verification-title">
      <div>
        <h2 id="verification-title">Verificação</h2>
        <p>{mode === 'manual' ? 'Leia, execute e verifique quando estiver pronto.' : 'Atualizado automaticamente conforme você edita.'}</p>
      </div>
      {mode === 'manual' && <button className="verify-button" type="button" onClick={onVerify}>Verificar atividade</button>}
      {hasUnverifiedChanges && results && <p className="verification-pending" role="status">Há alterações não verificadas neste documento.</p>}
      {results && (
        <div className="check-results" aria-live="polite">
          <p className="check-summary">{completed} de {results.length} requisitos concluídos</p>
          <ul>
            {results.map((result) => (
              <li className={result.passed ? 'passed' : 'pending'} key={result.id}>
                <span aria-hidden="true">{result.passed ? '✓' : '×'}</span>
                <span>{result.label}{!result.passed && result.hint ? <small>{result.hint}</small> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
