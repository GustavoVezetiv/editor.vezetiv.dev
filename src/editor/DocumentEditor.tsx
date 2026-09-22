import { FontSize, TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import StarterKit from '@tiptap/starter-kit'
import type { DocumentPreset, EditorTool, PastePolicy } from '../types/activity'
import { EditorToolbar } from './EditorToolbar'

interface DocumentEditorProps {
  initialContent: JSONContent
  pastePolicy: PastePolicy
  enabledTools: EditorTool[]
  preset: DocumentPreset
  onDocumentChange: (content: JSONContent) => void
  onBlockedInput: () => void
  onFormatApplied?: (tool: EditorTool) => void
  highlightedTool?: EditorTool | null
  readOnly?: boolean
}

export function DocumentEditor({ initialContent, pastePolicy, enabledTools, preset, onDocumentChange, onBlockedInput, onFormatApplied, highlightedTool, readOnly = false }: DocumentEditorProps) {
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] }, underline: false }),
      Underline,
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: initialContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'document-content',
        'aria-label': 'Documento da atividade',
        spellcheck: 'true',
        lang: 'pt-BR',
      },
      handlePaste: (_view, event) => {
        if (pastePolicy === 'allowed') return false
        event.preventDefault()
        onBlockedInput()
        return true
      },
      handleDrop: (_view, event) => {
        if (pastePolicy === 'allowed') return false
        event.preventDefault()
        onBlockedInput()
        return true
      },
      handleKeyDown: (_view, event) => {
        const isPasteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v'
        const isShiftInsert = event.shiftKey && event.key === 'Insert'
        if (pastePolicy === 'blocked' && (isPasteShortcut || isShiftInsert)) {
          event.preventDefault()
          onBlockedInput()
          return true
        }
        const shortcutTools: Record<string, EditorTool> = { b: 'bold', i: 'italic', u: 'underline' }
        const shortcutTool = (event.ctrlKey || event.metaKey) ? shortcutTools[event.key.toLowerCase()] : undefined
        if (shortcutTool && !enabledTools.includes(shortcutTool)) {
          event.preventDefault()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: updatedEditor }) => onDocumentChange(updatedEditor.getJSON()),
  })

  useEffect(() => { editor?.setEditable(!readOnly) }, [editor, readOnly])

  return (
    <section className="document-workspace" aria-label="Área de edição">
      {!readOnly && <EditorToolbar editor={editor} enabledTools={enabledTools} onFormatApplied={onFormatApplied} highlightedTool={highlightedTool} />}
      {readOnly && <div className="read-only-banner">Atividade concluída · documento somente leitura</div>}
      <div className="page-stage">
        <div className={`document-page document-page--${preset}`}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  )
}
