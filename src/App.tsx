import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { ActivityPanel } from './activity/ActivityPanel'
import { activity01 } from './config/activity01'
import { DocumentEditor } from './editor/DocumentEditor'
import { exportDocument, type ExportFormat } from './export/documentExport'
import type { CheckResult } from './types/activity'
import { loadSavedActivity, saveActivity } from './utils/storage'
import { verifyActivity } from './verification/verifyActivity'

const loadedActivity = loadSavedActivity(activity01)

function App() {
  const [initialContent] = useState<JSONContent>(() => loadedActivity?.content ?? activity01.initialContent)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(loadedActivity?.savedAt ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [pasteNotice, setPasteNotice] = useState(false)
  const [verification, setVerification] = useState<CheckResult[]>(() => verifyActivity(initialContent, activity01))
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const documentRef = useRef<JSONContent>(initialContent)
  const saveTimerRef = useRef<number | null>(null)
  const noticeTimerRef = useRef<number | null>(null)

  const persistDocument = useCallback((content: JSONContent) => {
    const savedAt = new Date().toISOString()
    const saved = saveActivity({ activityId: activity01.id, content, savedAt })
    setSaveFailed(!saved)
    if (saved) setLastSavedAt(savedAt)
    setIsSaving(false)
  }, [])

  useEffect(() => {
    const saveBeforeExit = () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        persistDocument(documentRef.current)
      }
    }

    window.addEventListener('pagehide', saveBeforeExit)
    return () => {
      window.removeEventListener('pagehide', saveBeforeExit)
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    }
  }, [persistDocument])

  const handleDocumentChange = useCallback((content: JSONContent) => {
    documentRef.current = content
    setVerification(verifyActivity(content, activity01))
    setIsSaving(true)
    setSaveFailed(false)
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      persistDocument(content)
    }, 500)
  }, [persistDocument])

  const showPasteNotice = useCallback(() => {
    setPasteNotice(true)
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setPasteNotice(false), 4200)
  }, [])

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportingFormat(format)
    setExportError(null)
    try {
      await exportDocument(documentRef.current, format)
    } catch {
      setExportError(`Não foi possível exportar o arquivo ${format.toUpperCase()}.`)
    } finally {
      setExportingFormat(null)
    }
  }, [])

  const saveLabel = saveFailed ? 'Não foi possível salvar' : isSaving ? 'Salvando…' : 'Salvo ✓'
  const saveTitle = saveFailed
    ? 'O armazenamento deste navegador não está disponível.'
    : lastSavedAt
      ? `Última alteração salva às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSavedAt))}`
      : 'As alterações serão salvas automaticamente'

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Editor Vezetiv, início">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>Editor Vezetiv</span>
        </a>
        <div className="header-activity">{activity01.title}</div>
        <div className="header-actions">
          <button className="export-button" type="button" onClick={() => handleExport('docx')} disabled={exportingFormat !== null}>
            {exportingFormat === 'docx' ? 'Exportando…' : 'Exportar DOCX'}
          </button>
          <button className="export-button" type="button" onClick={() => handleExport('pdf')} disabled={exportingFormat !== null}>
            {exportingFormat === 'pdf' ? 'Exportando…' : 'Exportar PDF'}
          </button>
          <div className={`save-status ${isSaving ? 'saving' : ''} ${saveFailed ? 'failed' : ''}`} title={saveTitle} aria-live="polite">{saveLabel}</div>
        </div>
      </header>

      <div className="workbench">
        <ActivityPanel activity={activity01} results={verification} />
        <div className="editor-column">
          <DocumentEditor
            initialContent={initialContent}
            pastePolicy={activity01.pastePolicy}
            onDocumentChange={handleDocumentChange}
            onBlockedInput={showPasteNotice}
          />
        </div>
      </div>

      {pasteNotice && (
        <div className="paste-notice" role="status">
          A colagem está desativada nesta atividade. Digite o conteúdo utilizando o editor.
        </div>
      )}
      {exportError && <div className="export-notice" role="alert">{exportError}</div>}
    </main>
  )
}

export default App
