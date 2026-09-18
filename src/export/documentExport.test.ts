import assert from 'node:assert/strict'
import test from 'node:test'
import type { JSONContent } from '@tiptap/core'
import { textSegments, toDocumentBlocks } from './documentExport'

const documentWithFormatting: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Título' }] },
    { type: 'paragraph', attrs: { textAlign: 'justify' }, content: [
      { type: 'text', text: 'Negrito', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' itálico', marks: [{ type: 'italic' }] },
      { type: 'text', text: ' sublinhado', marks: [{ type: 'underline' }] },
      { type: 'text', text: ' grande', marks: [{ type: 'textStyle', attrs: { fontSize: '16pt' } }] },
    ] },
    { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] }] },
  ],
}

test('preserva marcas e tamanho em segmentos exportáveis', () => {
  const segments = textSegments(documentWithFormatting.content?.[1].content)
  assert.deepEqual(segments.map(({ text, bold, italic, underline, fontSize }) => ({ text, bold, italic, underline, fontSize })), [
    { text: 'Negrito', bold: true, italic: false, underline: false, fontSize: undefined },
    { text: ' itálico', bold: false, italic: true, underline: false, fontSize: undefined },
    { text: ' sublinhado', bold: false, italic: false, underline: true, fontSize: undefined },
    { text: ' grande', bold: false, italic: false, underline: false, fontSize: 16 },
  ])
})

test('converte headings, alinhamento e listas para blocos de exportação', () => {
  const blocks = toDocumentBlocks(documentWithFormatting)
  assert.equal(blocks[0].type, 'heading')
  assert.equal(blocks[0].alignment, 'center')
  assert.equal(blocks[1].alignment, 'justify')
  assert.equal(blocks[2].type, 'ordered-list')
  assert.equal(blocks[3].type, 'bullet-list')
})
