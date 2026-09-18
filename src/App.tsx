import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { ActivityPanel } from './activity/ActivityPanel'
import { activity01 } from './config/activity01'
import { DocumentTabs } from './documents/DocumentTabs'
import { DocumentEditor } from './editor/DocumentEditor'
import { exportDocument, type ExportFormat } from './export/documentExport'
import type { ActivityDocument, DocumentPreset, SavedActivity } from './types/activity'
import { loadSavedActivity, saveActivity } from './utils/storage'
import { type CheckResult, verifyActivity } from './verification/verifyActivity'

function createDocument(name: string, content: JSONContent = activity01.initialContent): ActivityDocument {
  const updatedAt = new Date().toISOString()
  return {
    id: `document-${crypto.randomUUID()}`,
    name,
    content,
    preset: activity01.defaultDocumentPreset,
    updatedAt,
  }
}

function createInitialWorkspace(): SavedActivity {
  const document = createDocument('Documento 1')
  return {
    activityId: activity01.id,
    documents: [document],
    activeDocumentId: document.id,
    savedAt: document.updatedAt,
  }
}

function documentHasContent(document: ActivityDocument): boolean {
  const readText = (node: JSONContent): string => node.type === 'text'
    ? node.text ?? ''
    : (node.content ?? []).map(readText).join('')
  return readText(document.content).trim().length > 0
}

const restoredWorkspace = loadSavedActivity(activity01) ?? createInitialWorkspace()

function App() {
  const [documents, setDocuments] = useState<ActivityDocument[]>(restoredWorkspace.documents)
  const [activeDocumentId, setActiveDocumentId] = useState(restoredWorkspace.activeDocumentId)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(restoredWorkspace.savedAt)
  const [isSaving, setIsSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [pasteNotice, setPasteNotice] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [resultsByDocument, setResultsByDocument] = useState<Record<string, CheckResult[]>>({})
  const [dirtyVerification, setDirtyVerification] = useState<Record<string, boolean>>({})
  const documentsRef = useRef(documents)
  const activeDocumentIdRef = useRef(activeDocumentId)
  const saveTimerRef = useRef<number | null>(null)
  const noticeTimerRef = useRef<number | null>(null)

  const persistWorkspace = useCallback((nextDocuments: ActivityDocument[], nextActiveDocumentId: string) => {
    const savedAt = new Date().toISOString()
    const saved = saveActivity({
      activityId: activity01.id,
      documents: nextDocuments,
      activeDocumentId: nextActiveDocumentId,
      savedAt,
    })
    setSaveFailed(!saved)
    if (saved) setLastSavedAt(savedAt)
    setIsSaving(false)
  }, [])

  const scheduleSave = useCallback((nextDocuments: ActivityDocument[], nextActiveDocumentId: string) => {
    setIsSaving(true)
    setSaveFailed(false)
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      persistWorkspace(nextDocuments, nextActiveDocumentId)
    }, 500)
  }, [persistWorkspace])

  const updateWorkspace = useCallback((nextDocuments: ActivityDocument[], nextActiveDocumentId = activeDocumentIdRef.current) => {
    documentsRef.current = nextDocuments
    activeDocumentIdRef.current = nextActiveDocumentId
    setDocuments(nextDocuments)
    setActiveDocumentId(nextActiveDocumentId)
    scheduleSave(nextDocuments, nextActiveDocumentId)
  }, [scheduleSave])

  useEffect(() => {
    const saveBeforeExit = () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        persistWorkspace(documentsRef.current, activeDocumentIdRef.current)
      }
    }

    window.addEventListener('pagehide', saveBeforeExit)
    return () => {
      window.removeEventListener('pagehide', saveBeforeExit)
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    }
  }, [persistWorkspace])

  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]
  const verification = resultsByDocument[activeDocument.id] ?? null
  const hasUnverifiedChanges = dirtyVerification[activeDocument.id] ?? false

  const handleDocumentChange = useCallback((content: JSONContent) => {
    const documentId = activeDocumentIdRef.current
    const timestamp = new Date().toISOString()
    const nextDocuments = documentsRef.current.map((document) => document.id === documentId
      ? { ...document, content, updatedAt: timestamp }
      : document)
    updateWorkspace(nextDocuments)

    if (activity01.verificationMode === 'live') {
      setResultsByDocument((current) => ({ ...current, [documentId]: verifyActivity(content, activity01) }))
      setDirtyVerification((current) => ({ ...current, [documentId]: false }))
    } else {
      setDirtyVerification((current) => ({ ...current, [documentId]: true }))
    }
  }, [updateWorkspace])

  const handleVerify = useCallback(() => {
    const currentDocument = documentsRef.current.find((document) => document.id === activeDocumentIdRef.current)
    if (!currentDocument) return
    setResultsByDocument((current) => ({ ...current, [currentDocument.id]: verifyActivity(currentDocument.content, activity01) }))
    setDirtyVerification((current) => ({ ...current, [currentDocument.id]: false }))
  }, [])

  const handlePresetChange = useCallback((preset: DocumentPreset) => {
    const documentId = activeDocumentIdRef.current
    const timestamp = new Date().toISOString()
    const nextDocuments = documentsRef.current.map((document) => document.id === documentId
      ? { ...document, preset, updatedAt: timestamp }
      : document)
    updateWorkspace(nextDocuments)
  }, [updateWorkspace])

  const handleSelectDocument = useCallback((documentId: string) => {
    if (!documentsRef.current.some((document) => document.id === documentId)) return
    updateWorkspace(documentsRef.current, documentId)
  }, [updateWorkspace])

  const handleCreateDocument = useCallback(() => {
    const document = createDocument(`Documento ${documentsRef.current.length + 1}`)
    updateWorkspace([...documentsRef.current, document], document.id)
  }, [updateWorkspace])

  const handleRenameDocument = useCallback((documentId: string) => {
    const document = documentsRef.current.find((item) => item.id === documentId)
    if (!document) return
    const name = window.prompt('Nome do documento:', document.name)?.trim()
    if (!name || name === document.name) return
    updateWorkspace(documentsRef.current.map((item) => item.id === documentId ? { ...item, name, updatedAt: new Date().toISOString() } : item))
  }, [updateWorkspace])

  const handleCloseDocument = useCallback((documentId: string) => {
    if (documentsRef.current.length === 1) return
    const document = documentsRef.current.find((item) => item.id === documentId)
    if (!document) return
    if (documentHasContent(document) && !window.confirm(`Excluir “${document.name}”? Esta ação não pode ser desfeita.`)) return

    const nextDocuments = documentsRef.current.filter((item) => item.id !== documentId)
    const nextActiveDocumentId = documentId === activeDocumentIdRef.current ? nextDocuments[0].id : activeDocumentIdRef.current
    updateWorkspace(nextDocuments, nextActiveDocumentId)
  }, [updateWorkspace])

  const showPasteNotice = useCallback(() => {
    setPasteNotice(true)
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setPasteNotice(false), 4200)
  }, [])

  const handleExport = useCallback(async (format: ExportFormat) => {
    const currentDocument = documentsRef.current.find((document) => document.id === activeDocumentIdRef.current)
    if (!currentDocument) return
    setExportingFormat(format)
    setExportError(null)
    try {
      await exportDocument(currentDocument.content, format, currentDocument.name, currentDocument.preset)
    } catch {
      setExportError(`Não foi possível exportar “${currentDocument.name}” em ${format.toUpperCase()}.`)
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
        <a className="brand" href="/" aria-label="Editor Vezetiv, início"><span className="brand-mark" aria-hidden="true">V</span><span>Editor Vezetiv</span></a>
        <div className="header-activity">{activity01.title}</div>
        <div className={`save-status ${isSaving ? 'saving' : ''} ${saveFailed ? 'failed' : ''}`} title={saveTitle} aria-live="polite">{saveLabel}</div>
      </header>

      <div className="workbench">
        <ActivityPanel
          activity={activity01}
          results={verification}
          hasUnverifiedChanges={hasUnverifiedChanges}
          onVerify={handleVerify}
        />
        <div className="editor-column">
          <DocumentTabs
            documents={documents}
            activeDocumentId={activeDocument.id}
            verificationMode={activity01.verificationMode}
            onSelect={handleSelectDocument}
            onCreate={handleCreateDocument}
            onRename={handleRenameDocument}
            onClose={handleCloseDocument}
            onPresetChange={handlePresetChange}
            onExport={handleExport}
            exportingFormat={exportingFormat}
          />
          <DocumentEditor
            key={activeDocument.id}
            initialContent={activeDocument.content}
            preset={activeDocument.preset}
            enabledTools={activity01.enabledTools}
            pastePolicy={activity01.pastePolicy}
            onDocumentChange={handleDocumentChange}
            onBlockedInput={showPasteNotice}
          />
        </div>
      </div>

      {pasteNotice && <div className="paste-notice" role="status">A colagem está desativada nesta atividade. Digite o conteúdo utilizando o editor.</div>}
      {exportError && <div className="export-notice" role="alert">{exportError}</div>}
    </main>
  )
}

export default App
