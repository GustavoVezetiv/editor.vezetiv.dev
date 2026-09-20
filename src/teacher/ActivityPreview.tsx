import { useMemo, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { Activity } from '../types/activity'
import { DocumentEditor } from '../editor/DocumentEditor'
import { verifyActivity } from '../verification/verifyActivity'

export function ActivityPreview({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const [content, setContent] = useState<JSONContent>(activity.initialContent)
  const [verified, setVerified] = useState(false)
  const results = useMemo(() => verified ? verifyActivity(content, activity, activity.defaultDocumentPreset) : null, [activity, content, verified])
  return <div className="preview-shell" role="dialog" aria-modal="true" aria-label="Preview da atividade"><header className="app-header"><button className="link-button" onClick={onClose}>← Fechar preview</button><div className="header-activity">Preview · {activity.title}</div><span className="save-status">Não cria tentativa</span></header><div className="workbench"><aside className="activity-panel"><div className="activity-scroll"><div className="activity-kicker">Visualização do aluno</div><h1>{activity.title}</h1><p className="activity-description">{activity.description}</p><ol className="instruction-list">{activity.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>{activity.sourceText && <section className="source-text"><h2>Texto para digitar</h2><p>{activity.sourceText}</p></section>}</div><section className="verification-panel"><button className="verify-button" onClick={() => setVerified(true)}>Verificar preview</button>{results && <ul className="preview-results">{results.map((result) => <li key={result.id} className={result.passed ? 'passed' : 'pending'}>{result.passed ? '✓' : '×'} {result.label}</li>)}</ul>}</section></aside><div className="editor-column"><DocumentEditor initialContent={content} preset={activity.defaultDocumentPreset} enabledTools={activity.enabledTools} pastePolicy={activity.pastePolicy} onDocumentChange={(next) => { setContent(next); setVerified(false) }} onBlockedInput={() => undefined} /></div></div></div>
}
