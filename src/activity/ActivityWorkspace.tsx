import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { Activity, ActivityDocument, DocumentPreset, EditorTool } from '../types/activity'
import type { ActivityAttempt, Student, VerificationRun } from '../types/platform'
import { ActivityPanel } from './ActivityPanel'
import { DocumentTabs } from '../documents/DocumentTabs'
import { DocumentEditor } from '../editor/DocumentEditor'
import { exportDocument, type ExportFormat } from '../export/documentExport'
import { createPedagogicalEvent, logPedagogicalEvent, type PedagogicalEventType } from '../events/pedagogicalEvents'
import { calculateScore } from '../verification/scoring'
import { verifyActivity } from '../verification/verifyActivity'
import type { RemoteSaveState, SavedAttempt } from '../services/platformRepository'

interface ActivityWorkspaceProps {
  activity: Activity
  student: Student
  initialAttempt: ActivityAttempt
  onSaveAttempt: (attempt: ActivityAttempt) => Promise<SavedAttempt>
  onBack: () => void
}

const hasContent = (document: ActivityDocument) => JSON.stringify(document.content).includes('"text"')

export function ActivityWorkspace({ activity, student, initialAttempt, onSaveAttempt, onBack }: ActivityWorkspaceProps) {
  const [attempt, setAttempt] = useState(initialAttempt)
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [pasteNotice, setPasteNotice] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [saveState, setSaveState] = useState<'saving' | RemoteSaveState>('local')
  const [highlightedTool, setHighlightedTool] = useState<EditorTool | null>(null)
  const [completionOpen, setCompletionOpen] = useState(false)
  const timer = useRef<number | null>(null)
  const attemptRef = useRef(attempt)
  const saveRevision = useRef(0)
  const activeDocument = attempt.documents.find((document) => document.id === attempt.activeDocumentId) ?? attempt.documents[0]
  const latestRun = [...attempt.verificationRuns].reverse().find((run) => run.documentId === activeDocument.id)

  const persist = useCallback((next: ActivityAttempt, instant = false) => {
    attemptRef.current = next
    setAttempt(next)
    if (timer.current) window.clearTimeout(timer.current)
    const revision = ++saveRevision.current
    const save = async () => {
      setSaveState('saving')
      const saved = await onSaveAttempt(next)
      if (revision !== saveRevision.current) return
      attemptRef.current = saved.attempt
      setAttempt(saved.attempt)
      setSaveState(saved.remoteState)
    }
    if (instant) void save()
    else timer.current = window.setTimeout(() => { void save() }, 500)
  }, [onSaveAttempt])

  useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); void onSaveAttempt(attemptRef.current) } }, [onSaveAttempt])

  const withEvent = useCallback((next: ActivityAttempt, type: PedagogicalEventType, documentId: string, metadata: Record<string, unknown> = {}) => {
    const latest = next.events.at(-1)
    if (type === 'format_applied' && latest?.type === type && latest.documentId === documentId && latest.metadata.tool === metadata.tool && Date.now() - new Date(latest.timestamp).getTime() < 2_000) return next
    const event = createPedagogicalEvent({ activityId: activity.id, attemptId: next.id, documentId, type, metadata })
    logPedagogicalEvent(event)
    return { ...next, events: [...next.events, event], updatedAt: event.timestamp }
  }, [activity.id])

  const updateDocument = useCallback((content: JSONContent) => {
    const next = { ...attemptRef.current, documents: attemptRef.current.documents.map((document) => document.id === attemptRef.current.activeDocumentId ? { ...document, content, updatedAt: new Date().toISOString() } : document) }
    persist(next)
    if (activity.verificationMode === 'manual') setDirty((current) => ({ ...current, [next.activeDocumentId]: true }))
  }, [activity.verificationMode, persist])

  const recordFormat = useCallback((tool: EditorTool) => {
    const next = withEvent(attemptRef.current, 'format_applied', attemptRef.current.activeDocumentId, { tool })
    persist(next)
  }, [persist, withEvent])

  const verify = useCallback(() => {
    const current = attemptRef.current
    const document = current.documents.find((item) => item.id === current.activeDocumentId)!
    const results = verifyActivity(document.content, activity, document.preset)
    const score = calculateScore(activity, results)
    const run: VerificationRun = { id: `verification-${crypto.randomUUID()}`, attemptId: current.id, documentId: document.id, score: score.earnedPoints, results, createdAt: new Date().toISOString() }
    let next = { ...current, currentScore: score.earnedPoints, verificationRuns: [...current.verificationRuns, run] }
    next = withEvent(next, 'verification_requested', document.id)
    next = withEvent(next, 'verification_completed', document.id, { score: score.earnedPoints })
    persist(next, true)
    setDirty((currentDirty) => ({ ...currentDirty, [document.id]: false }))
  }, [activity, persist, withEvent])

  const selectDocument = (documentId: string) => persist({ ...attemptRef.current, activeDocumentId: documentId })
  const createDocument = () => {
    const timestamp = new Date().toISOString()
    const document: ActivityDocument = { id: `document-${crypto.randomUUID()}`, name: `Documento ${attemptRef.current.documents.length + 1}`, content: activity.initialContent, preset: activity.defaultDocumentPreset, updatedAt: timestamp }
    persist(withEvent({ ...attemptRef.current, documents: [...attemptRef.current.documents, document], activeDocumentId: document.id }, 'document_created', document.id), true)
  }
  const renameDocument = (documentId: string) => {
    const old = attemptRef.current.documents.find((document) => document.id === documentId)
    const name = old && window.prompt('Nome do documento:', old.name)?.trim()
    if (!old || !name || name === old.name) return
    persist(withEvent({ ...attemptRef.current, documents: attemptRef.current.documents.map((document) => document.id === documentId ? { ...document, name, updatedAt: new Date().toISOString() } : document) }, 'document_renamed', documentId, { name }), true)
  }
  const closeDocument = (documentId: string) => {
    const current = attemptRef.current
    if (current.documents.length === 1) return
    const document = current.documents.find((item) => item.id === documentId)
    if (!document || (hasContent(document) && !window.confirm(`Excluir “${document.name}”? Esta ação não pode ser desfeita.`))) return
    const documents = current.documents.filter((item) => item.id !== documentId)
    persist(withEvent({ ...current, documents, activeDocumentId: current.activeDocumentId === documentId ? documents[0].id : current.activeDocumentId }, 'document_deleted', documentId), true)
  }
  const setPreset = (preset: DocumentPreset) => {
    const next = { ...attemptRef.current, documents: attemptRef.current.documents.map((document) => document.id === attemptRef.current.activeDocumentId ? { ...document, preset, updatedAt: new Date().toISOString() } : document) }
    persist(withEvent(next, 'preset_changed', next.activeDocumentId, { preset }))
  }
  const blockedPaste = () => { persist(withEvent(attemptRef.current, 'paste_blocked', attemptRef.current.activeDocumentId)); setPasteNotice(true); window.setTimeout(() => setPasteNotice(false), 4200) }
  const openHint = (requirementId: string) => persist(withEvent(attemptRef.current, 'hint_opened', attemptRef.current.activeDocumentId, { requirementId }))
  const complete = () => setCompletionOpen(true)
  const confirmCompletion = () => {
    persist(withEvent({ ...attemptRef.current, status: 'completed', completedAt: new Date().toISOString() }, 'activity_completed', attemptRef.current.activeDocumentId), true)
    setCompletionOpen(false)
  }
  const hintTool = (requirementId: string | null): EditorTool | null => {
    const requirement = activity.requirements.find((item) => item.id === requirementId)
    if (!requirement) return null
    if (requirement.type === 'heading') return 'heading'
    if (requirement.type === 'alignment') return 'alignment'
    if (requirement.type === 'text-mark') return requirement.mark
    if (requirement.type === 'ordered-list') return 'orderedList'
    if (requirement.type === 'bullet-list') return 'bulletList'
    return null
  }
  const exportActive = async (format: ExportFormat) => { setExporting(format); try { await exportDocument(activeDocument.content, format, activeDocument.name, activeDocument.preset) } finally { setExporting(null) } }

  const results = latestRun?.results ?? null
  const pending = results?.filter((result) => !result.passed) ?? activity.requirements
  const score = latestRun?.score ?? 0
  const saveLabel = saveState === 'saving' ? 'Salvando…' : saveState === 'synced' ? 'Sincronizado' : saveState === 'retrying' ? 'Salvo localmente · nova tentativa pendente' : 'Salvo neste dispositivo'
  return <main className="app-shell"><header className="app-header"><button className="link-button" onClick={onBack}>← Atividades</button><div className="header-activity">{activity.title}</div><div className={`save-status ${saveState === 'saving' ? 'saving' : saveState === 'retrying' ? 'failed' : ''}`}>{student.displayName} · {saveLabel}</div></header><div className="workbench"><ActivityPanel activity={activity} results={results} hasUnverifiedChanges={dirty[activeDocument.id] ?? false} onVerify={verify} onHintOpened={openHint} onHintChanged={(id) => setHighlightedTool(hintTool(id))} onComplete={complete} isCompleted={attempt.status === 'completed'} /><div className="editor-column"><DocumentTabs documents={attempt.documents} activeDocumentId={activeDocument.id} verificationMode={activity.verificationMode} onSelect={selectDocument} onCreate={createDocument} onRename={renameDocument} onClose={closeDocument} onPresetChange={setPreset} onExport={exportActive} exportingFormat={exporting} /><DocumentEditor key={activeDocument.id} initialContent={activeDocument.content} preset={activeDocument.preset} enabledTools={activity.enabledTools} pastePolicy={activity.pastePolicy} onDocumentChange={updateDocument} onBlockedInput={blockedPaste} onFormatApplied={recordFormat} highlightedTool={highlightedTool} /></div></div>{pasteNotice && <div className="paste-notice" role="status">A colagem está desativada nesta atividade. Digite o conteúdo utilizando o editor.</div>}{completionOpen && <div className="modal-backdrop" role="presentation"><section className="completion-modal" role="dialog" aria-modal="true" aria-labelledby="completion-title"><h2 id="completion-title">Concluir atividade?</h2><p>Você obteve <strong>{score} / {activity.scoring.totalPoints} pontos</strong>.</p>{!results && <p className="verification-pending">Faça uma verificação antes de concluir para receber o diagnóstico completo.</p>}{pending.length > 0 && <><h3>Pendências</h3><ul>{pending.map((result) => <li key={result.id}>{result.label}</li>)}</ul></>}<div className="modal-actions"><button className="link-button" onClick={() => setCompletionOpen(false)}>Continuar editando</button><button className="complete-button" onClick={confirmCompletion}>Concluir mesmo assim</button></div></section></div>}</main>
}
