import type { Activity } from '../types/activity'
import type { CheckResult } from '../verification/verifyActivity'
import { VerificationPanel } from '../verification/VerificationPanel'

interface ActivityPanelProps {
  activity: Activity
  results: CheckResult[] | null
  hasUnverifiedChanges: boolean
  onVerify: () => void
}

export function ActivityPanel({ activity, results, hasUnverifiedChanges, onVerify }: ActivityPanelProps) {
  return (
    <aside className="activity-panel" aria-labelledby="activity-title">
      <div className="activity-scroll">
        <div className="activity-kicker">Atividade em andamento</div>
        <h1 id="activity-title">{activity.title}</h1>
        <p className="activity-description">{activity.description}</p>

        <section className="instruction-section">
          <h2>O que fazer</h2>
          <ol className="instruction-list">
            {activity.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
          </ol>
        </section>

        <section className="source-text" aria-labelledby="source-text-title">
          <h2 id="source-text-title">Texto para digitar</h2>
          <p>{activity.sourceText}</p>
        </section>

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
      />
    </aside>
  )
}
