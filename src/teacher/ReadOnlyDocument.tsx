import type { ActivityDocument } from '../types/activity'
import { DocumentEditor } from '../editor/DocumentEditor'

export function ReadOnlyDocument({ document }: { document?: ActivityDocument }) {
  if (!document) return <p className="empty-state">Nenhum documento salvo.</p>
  return <div className="teacher-document-preview"><DocumentEditor initialContent={document.content} preset={document.preset} enabledTools={[]} pastePolicy="blocked" readOnly onDocumentChange={() => undefined} onBlockedInput={() => undefined} /></div>
}
