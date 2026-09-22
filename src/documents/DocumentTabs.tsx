import type { ActivityDocument, DocumentPreset } from '../types/activity'

interface DocumentTabsProps {
  documents: ActivityDocument[]
  activeDocumentId: string
  onSelect: (documentId: string) => void
  onCreate: () => void
  onRename: (documentId: string) => void
  onClose: (documentId: string) => void
  onPresetChange: (preset: DocumentPreset) => void
  onExport: (format: 'docx' | 'pdf') => void
  exportingFormat: 'docx' | 'pdf' | null
  readOnly?: boolean
  operationsDisabled?: boolean
}

export function DocumentTabs({
  documents,
  activeDocumentId,
  onSelect,
  onCreate,
  onRename,
  onClose,
  onPresetChange,
  onExport,
  exportingFormat,
  readOnly = false,
  operationsDisabled = false,
}: DocumentTabsProps) {
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]

  return (
    <div className="document-controls">
      <div className="document-tabs" role="tablist" aria-label="Documentos da atividade">
        {documents.map((document) => (
          <div className="document-tab-wrap" key={document.id}>
            <button
              className={`document-tab ${document.id === activeDocumentId ? 'is-active' : ''}`}
              role="tab"
              aria-selected={document.id === activeDocumentId}
              type="button"
              disabled={operationsDisabled}
              onClick={() => onSelect(document.id)}
            >
              {document.name}
            </button>
            {document.id === activeDocumentId && !readOnly && !operationsDisabled && (
              <span className="tab-actions">
                <button type="button" className="tab-icon-button" aria-label="Renomear documento" title="Renomear documento" onClick={() => onRename(document.id)}>✎</button>
                <button type="button" className="tab-icon-button" aria-label="Fechar documento" title="Fechar documento" onClick={() => onClose(document.id)}>×</button>
              </span>
            )}
          </div>
        ))}
        {!readOnly && !operationsDisabled && <button className="new-document-button" type="button" aria-label="Novo documento" title="Novo documento" onClick={onCreate}>+</button>}
      </div>

      <div className="document-control-actions">
        <label className="preset-control">
          <span>Formato</span>
          <select value={activeDocument.preset} onChange={(event) => onPresetChange(event.target.value as DocumentPreset)} aria-label="Preset do documento" disabled={readOnly || operationsDisabled}>
            <option value="academic-abnt">Acadêmico (ABNT)</option>
            <option value="normal">Normal</option>
          </select>
        </label>
        <details className="file-menu">
          <summary>Arquivo</summary>
          <div className="file-menu-content">
            <strong>Exportar {activeDocument.name}</strong>
            <button type="button" aria-label="Exportar documento atual em DOCX" onClick={() => onExport('docx')} disabled={exportingFormat !== null}>
              {exportingFormat === 'docx' ? 'Exportando DOCX…' : 'Exportar DOCX'}
            </button>
            <button type="button" aria-label="Exportar documento atual em PDF" onClick={() => onExport('pdf')} disabled={exportingFormat !== null}>
              {exportingFormat === 'pdf' ? 'Exportando PDF…' : 'Exportar PDF'}
            </button>
          </div>
        </details>
        <span className="verification-mode-label">Verificação manual</span>
      </div>
    </div>
  )
}
