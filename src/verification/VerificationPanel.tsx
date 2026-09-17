import type { CheckResult } from '../types/activity'

interface VerificationPanelProps {
  results: CheckResult[] | null
  onVerify: () => void
}

export function VerificationPanel({ results, onVerify }: VerificationPanelProps) {
  const completed = results?.filter((result) => result.passed).length ?? 0

  return (
    <section className="verification-panel" aria-labelledby="verification-title">
      <div>
        <h2 id="verification-title">Verificação</h2>
        <p>{results ? 'Edite e verifique novamente quando quiser.' : 'Confira os requisitos antes de concluir.'}</p>
      </div>
      <button className="verify-button" type="button" onClick={onVerify}>Verificar atividade</button>
      {results && (
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
      )}
    </section>
  )
}
