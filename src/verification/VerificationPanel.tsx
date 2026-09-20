import { useState } from 'react'
import type { Activity, VerificationMode } from '../types/activity'
import { calculateScore } from './scoring'
import type { CheckResult } from './verifyActivity'

interface VerificationPanelProps {
  activity: Activity
  mode: VerificationMode
  results: CheckResult[] | null
  hasUnverifiedChanges: boolean
  onVerify: () => void
  onHintOpened: (requirementId: string) => void
  onHintChanged?: (requirementId: string | null) => void
  readOnly?: boolean
}

export function VerificationPanel({ activity, mode, results, hasUnverifiedChanges, onVerify, onHintOpened, onHintChanged, readOnly = false }: VerificationPanelProps) {
  const [openHintId, setOpenHintId] = useState<string | null>(null)
  const completed = results?.filter((result) => result.passed).length ?? 0
  const score = results ? calculateScore(activity, results) : null

  const toggleHint = (requirementId: string) => {
    const willOpen = openHintId !== requirementId
    setOpenHintId(willOpen ? requirementId : null)
    onHintChanged?.(willOpen ? requirementId : null)
    if (willOpen) onHintOpened(requirementId)
  }

  return (
    <section className="verification-panel" aria-labelledby="verification-title">
      <div>
        <h2 id="verification-title">Verificação</h2>
        <p>{mode === 'manual' ? 'Leia, execute e verifique quando estiver pronto.' : 'Atualizado automaticamente conforme você edita.'}</p>
      </div>
      {mode === 'manual' && <button className="verify-button" type="button" onClick={onVerify} disabled={readOnly}>Verificar atividade</button>}
      {hasUnverifiedChanges && results && <p className="verification-pending" role="status">O documento foi alterado. Verifique novamente.</p>}
      {results && results.length > 0 && (
        <div className="check-results" aria-live="polite">
          <p className="check-summary">{completed} de {results.length} requisitos concluídos</p>
          {score && <p className="score-summary">{score.earnedPoints} / {score.totalPoints} pontos</p>}
          <ul>
            {results.map((result) => {
              const hint = activity.hints.find((item) => item.requirementId === result.id)
              const isHintOpen = openHintId === result.id
              return (
                <li className={result.passed ? 'passed' : 'pending'} key={result.id}>
                  <span aria-hidden="true">{result.passed ? '✓' : '×'}</span>
                  <div>
                    <span>{result.label} <small>({result.points} pontos)</small>{result.detail && <small>{result.detail}</small>}{!result.passed && result.feedback && <small>{result.feedback}</small>}</span>
                    {!result.passed && hint && (
                      <>
                        <button className="hint-button" type="button" aria-expanded={isHintOpen} onClick={() => toggleHint(result.id)}>
                          {isHintOpen ? 'Ocultar dica' : 'Como fazer?'}
                        </button>
                        {isHintOpen && (
                          <div className="requirement-hint">
                            <strong>{hint.title}</strong>
                            <ol>{hint.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
