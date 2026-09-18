import { FontSize, TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
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
}

export function DocumentEditor({ initialContent, pastePolicy, enabledTools, preset, onDocumentChange, onBlockedInput }: DocumentEditorProps) {
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Underline,
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'document-content',
        'aria-label': 'Documento da atividade',
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
        return false
      },
    },
    onUpdate: ({ editor: updatedEditor }) => onDocumentChange(updatedEditor.getJSON()),
  })

  return (
    <section className="document-workspace" aria-label="Área de edição">
      <EditorToolbar editor={editor} enabledTools={enabledTools} />
      <div className="page-stage">
        <div className={`document-page document-page--${preset}`}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  )
}
