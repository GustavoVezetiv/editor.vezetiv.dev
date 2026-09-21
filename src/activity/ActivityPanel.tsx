import type { Activity } from '../types/activity'
import type { CheckResult } from '../verification/verifyActivity'
import { VerificationPanel } from '../verification/VerificationPanel'

interface ActivityPanelProps {
  activity: Activity
  results: CheckResult[] | null
  hasUnverifiedChanges: boolean
  onVerify: () => void
  onHintOpened: (requirementId: string) => void
  onHintChanged?: (requirementId: string | null) => void
  onComplete: () => void
  isCompleted: boolean
}

export function ActivityPanel({ activity, results, hasUnverifiedChanges, onVerify, onHintOpened, onHintChanged, onComplete, isCompleted }: ActivityPanelProps) {
  return (
    <aside className="activity-panel" aria-labelledby="activity-title">
      <div className="activity-scroll">
        <div className="activity-kicker">Atividade em andamento</div>
        <h1 id="activity-title">{activity.title}</h1>
        <p className="activity-description">{activity.description}</p>

        <section className="instruction-section" aria-labelledby="objectives-title">
          <h2 id="objectives-title">Objetivos</h2>
          <ol className="instruction-list">
            {activity.requirements.map((requirement) => <li key={requirement.id}>{requirement.objective}</li>)}
          </ol>
        </section>

        {activity.sourceText ? <section className="source-text" aria-labelledby="source-text-title">
          <h2 id="source-text-title">Texto para digitar</h2>
          <p>{activity.sourceText}</p>
        </section> : null}

        <section className="learning-note" aria-label="Como usar a atividade">
          <strong>Como aprender</strong>
          <p>Leia, entenda, execute, verifique e corrija.</p>
        </section>
      </div>
      <VerificationPanel
        mode={activity.verificationMode}
        results={results}
        hasUnverifiedChanges={hasUnverifiedChanges}
        onVerify={onVerify}
        activity={activity}
        onHintOpened={onHintOpened}
        onHintChanged={onHintChanged}
        readOnly={isCompleted}
      />
      <button className="complete-button" type="button" onClick={onComplete} disabled={isCompleted}>
        {isCompleted ? 'Atividade concluída' : 'Concluir atividade'}
      </button>
    </aside>
  )
}
