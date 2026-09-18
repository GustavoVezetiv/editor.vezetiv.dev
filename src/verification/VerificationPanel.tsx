import type { CheckResult } from '../types/activity'

interface VerificationPanelProps {
  results: CheckResult[]
}

export function VerificationPanel({ results }: VerificationPanelProps) {
  const completed = results.filter((result) => result.passed).length

  return (
    <section className="verification-panel" aria-labelledby="verification-title">
      <div>
        <h2 id="verification-title">Verificação</h2>
        <p>Atualizado automaticamente conforme você edita.</p>
      </div>
      <div className="check-results" aria-live="polite">
        <p className="check-summary">{completed} de {results.length} requisitos concluídos</p>
        <ul>
          {results.map((result) => (
            <li className={result.passed ? 'passed' : 'pending'} key={result.id}>
              <span aria-hidden="true">{result.passed ? '✓' : '×'}</span>
              {result.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
