import type { Editor } from '@tiptap/react'
import type { ButtonHTMLAttributes } from 'react'
import type { EditorTool } from '../types/activity'

interface EditorToolbarProps {
  editor: Editor | null
  enabledTools: EditorTool[]
}

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  label: string
}

function ToolbarButton({ active = false, label, className = '', ...props }: ToolbarButtonProps) {
  return (
    <button
      className={`toolbar-button ${active ? 'is-active' : ''} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      type="button"
      {...props}
    />
  )
}

function Divider() {
  return <div className="toolbar-divider" />
}

export function EditorToolbar({ editor, enabledTools }: EditorToolbarProps) {
  if (!editor) return <div className="editor-toolbar" aria-label="Barra de ferramentas" />

  const tools = new Set(enabledTools)
  const currentAlignment = editor.getAttributes('heading').textAlign
    ?? editor.getAttributes('paragraph').textAlign
    ?? 'left'
  const hasHistory = tools.has('undo') || tools.has('redo')
  const hasMarks = tools.has('bold') || tools.has('italic') || tools.has('underline')
  const hasTextControls = tools.has('heading') || tools.has('fontSize')
  const hasLists = tools.has('bulletList') || tools.has('orderedList')

  const setHeading = (level: 1 | 2 | 0) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run()
      return
    }
    editor.chain().focus().setHeading({ level }).run()
  }

  return (
    <div className="editor-toolbar" aria-label="Barra de ferramentas">
      {hasHistory && <div className="toolbar-group">
        {tools.has('undo') && <ToolbarButton label="Desfazer (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</ToolbarButton>}
        {tools.has('redo') && <ToolbarButton label="Refazer (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</ToolbarButton>}
      </div>}

      {hasHistory && hasMarks && <Divider />}

      {hasMarks && <div className="toolbar-group">
        {tools.has('bold') && <ToolbarButton label="Negrito (Ctrl+B)" active={editor.isActive('bold')} className="text-bold" onClick={() => editor.chain().focus().toggleBold().run()}>N</ToolbarButton>}
        {tools.has('italic') && <ToolbarButton label="Itálico (Ctrl+I)" active={editor.isActive('italic')} className="text-italic" onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarButton>}
        {tools.has('underline') && <ToolbarButton label="Sublinhado (Ctrl+U)" active={editor.isActive('underline')} className="text-underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>S</ToolbarButton>}
      </div>}

      {(hasHistory || hasMarks) && hasTextControls && <Divider />}

      {tools.has('heading') && <label className="select-control">
        <span className="sr-only">Estilo do texto</span>
        <select
          value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : 'p'}
          onChange={(event) => setHeading(event.target.value === 'h1' ? 1 : event.target.value === 'h2' ? 2 : 0)}
          aria-label="Estilo do texto"
        >
          <option value="p">Texto normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
        </select>
      </label>}

      {tools.has('fontSize') && <label className="select-control size-select">
        <span className="sr-only">Tamanho da fonte</span>
        <select
          value={editor.getAttributes('textStyle').fontSize ?? ''}
          onChange={(event) => {
            const command = editor.chain().focus()
            if (event.target.value) command.setFontSize(event.target.value).run()
            else command.unsetFontSize().run()
          }}
          aria-label="Tamanho da fonte"
        >
          <option value="">Tamanho</option>
          <option value="10pt">10</option>
          <option value="11pt">11</option>
          <option value="12pt">12</option>
          <option value="14pt">14</option>
          <option value="16pt">16</option>
          <option value="18pt">18</option>
        </select>
      </label>}

      {hasTextControls && tools.has('alignment') && <Divider />}

      {tools.has('alignment') && <div className="toolbar-group alignment-group">
        <ToolbarButton label="Alinhar à esquerda" active={currentAlignment === 'left'} onClick={() => editor.chain().focus().setTextAlign('left').run()}>≡</ToolbarButton>
        <ToolbarButton label="Centralizar" active={currentAlignment === 'center'} className="align-center" onClick={() => editor.chain().focus().setTextAlign('center').run()}>≡</ToolbarButton>
        <ToolbarButton label="Alinhar à direita" active={currentAlignment === 'right'} className="align-right" onClick={() => editor.chain().focus().setTextAlign('right').run()}>≡</ToolbarButton>
        <ToolbarButton label="Justificar" active={currentAlignment === 'justify'} className="align-justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()}>≡</ToolbarButton>
      </div>}

      {(hasHistory || hasMarks || hasTextControls || tools.has('alignment')) && hasLists && <Divider />}

      {hasLists && <div className="toolbar-group">
        {tools.has('bulletList') && <ToolbarButton label="Lista com marcadores" active={editor.isActive('bulletList')} className="list-button" onClick={() => editor.chain().focus().toggleBulletList().run()}>•≡</ToolbarButton>}
        {tools.has('orderedList') && <ToolbarButton label="Lista numerada" active={editor.isActive('orderedList')} className="list-button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1≡</ToolbarButton>}
      </div>}
    </div>
  )
}
