import assert from 'node:assert/strict'
import test from 'node:test'
import type { JSONContent } from '@tiptap/core'
import { activity01 } from '../config/activity01'
import { textSimilarity, verifyActivity } from './verifyActivity'

function resultsFor(content: JSONContent): Record<string, boolean> {
  return Object.fromEntries(verifyActivity(content, activity01).map((result) => [result.id, result.passed]))
}

function listItem(text: string): JSONContent {
  return { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

const correctDocument: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, textAlign: 'center' },
      content: [{ type: 'text', text: 'Preservação Ambiental' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'A ' },
        { type: 'text', text: 'sustentabilidade', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' depende de escolhas responsáveis no presente para preservar os recursos naturais no futuro.' },
      ],
    },
    { type: 'orderedList', content: [listItem('Primeiro item'), listItem('Segundo item'), listItem('Terceiro item')] },
  ],
}

test('aprova o documento que atende todos os requisitos semânticos', () => {
  assert.deepEqual(resultsFor(correctDocument), { title: true, alignment: true, 'source-text': true, bold: true, list: true })
})

test('exige heading principal correto e centralizado', () => {
  const titleAsParagraph: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preservação Ambiental' }] }],
  }
  const uncenteredHeading: JSONContent = {
    type: 'doc',
    content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Preservação Ambiental' }] }],
  }
  const otherHeading: JSONContent = {
    type: 'doc',
    content: [{ type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Outro título' }] }],
  }

  assert.deepEqual(resultsFor(titleAsParagraph), { title: false, alignment: false, 'source-text': false, bold: false, list: false })
  assert.deepEqual(resultsFor(uncenteredHeading), { title: true, alignment: false, 'source-text': false, bold: false, list: false })
  assert.deepEqual(resultsFor(otherHeading), { title: false, alignment: false, 'source-text': false, bold: false, list: false })
})

test('aceita espaços e caracteres invisíveis no título correto, mas não outro título', () => {
  const titleWithFormattingNoise: JSONContent = {
    type: 'doc',
    content: [{
      type: 'heading',
      attrs: { level: 1, textAlign: 'center' },
      content: [{ type: 'text', text: '  Preservação\u200B   Ambiental  ' }],
    }],
  }
  const differentTitle: JSONContent = {
    type: 'doc',
    content: [{
      type: 'heading',
      attrs: { level: 1, textAlign: 'center' },
      content: [{ type: 'text', text: 'Texto para digitar' }],
    }],
  }

  assert.equal(resultsFor(titleWithFormattingNoise).title, true)
  assert.equal(resultsFor(titleWithFormattingNoise).alignment, true)
  assert.equal(resultsFor(differentTitle).title, false)
})

test('exige a palavra inteira em negrito e uma lista numerada com três itens', () => {
  const partiallyBold: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'sustent', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'abilidade' },
    ] }],
  }
  const wrongWord: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'insustentabilidade', marks: [{ type: 'bold' }] }] }],
  }
  const twoItemList: JSONContent = {
    type: 'doc',
    content: [{ type: 'orderedList', content: [listItem('Um'), listItem('Dois')] }],
  }
  const bulletList: JSONContent = {
    type: 'doc',
    content: [{ type: 'bulletList', content: [listItem('Um'), listItem('Dois'), listItem('Três')] }],
  }

  assert.equal(resultsFor(partiallyBold).bold, false)
  assert.equal(resultsFor(wrongWord).bold, false)
  assert.equal(resultsFor(twoItemList).list, false)
  assert.equal(resultsFor(bulletList).list, false)
})

test('não aceita texto que apenas imita uma lista numerada', () => {
  const simulatedList: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '1 - Primeiro\n2 - Segundo\n3 - Terceiro' }] }],
  }

  assert.equal(resultsFor(simulatedList).list, false)
})

test('mantém o requisito de negrito quando outra ocorrência não está em negrito', () => {
  const multipleOccurrences: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'A sustentabilidade ', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'precisa de sustentabilidade diária.' },
    ] }],
  }

  assert.equal(resultsFor(multipleOccurrences).bold, true)
})

test('aceita palavra em negrito dividida em vários nós inline', () => {
  const splitBold: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'susten', marks: [{ type: 'bold' }] },
    { type: 'text', text: 'tabilidade', marks: [{ type: 'bold' }] },
  ] }] }
  assert.equal(resultsFor(splitBold).bold, true)
})

test('diferencia comparação exata de normalizada', () => {
  const content: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '  TEXTO   solicitado  ' }] }] }
  const requirement = { id: 'text', type: 'text-content' as const, text: 'Texto solicitado', points: 10, label: 'Texto', objective: 'Digitar.' }
  const exact = { ...activity01, requirements: [{ ...requirement, matchMode: 'exact' as const }] }
  const normalized = { ...activity01, requirements: [{ ...requirement, matchMode: 'normalized' as const }] }
  assert.equal(verifyActivity(content, exact)[0].passed, false)
  assert.equal(verifyActivity(content, normalized)[0].passed, true)
})

test('calcula similaridade local e determinística para texto solicitado', () => {
  assert.equal(textSimilarity('Texto de teste', 'Texto de teste'), 1)
  assert.ok(textSimilarity('Este é um texto suficientemente longo para validar pequenas diferenças de pontuação.', 'Este é um texto suficientemente longo para validar pequenas diferenças de pontuação') > 0.95)
})

test('reconhece listas com marcadores e preset como requisitos estruturais', () => {
  const activity = {
    ...activity01,
    requirements: [
      { id: 'bullet', type: 'bullet-list' as const, minItems: 2, points: 50, label: 'Marcadores', objective: 'Criar marcadores.' },
      { id: 'preset', type: 'document-preset' as const, preset: 'normal' as const, points: 50, label: 'Preset normal', objective: 'Usar Normal.' },
    ],
  }
  const content: JSONContent = { type: 'doc', content: [{ type: 'bulletList', content: [listItem('Um'), listItem('Dois')] }] }
  const result = Object.fromEntries(verifyActivity(content, activity, 'normal').map((check) => [check.id, check.passed]))
  assert.deepEqual(result, { bullet: true, preset: true })
})

test('explica quando o título existe mas ainda não usa o estilo solicitado', () => {
  const content: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preservação Ambiental' }] }] }
  const title = verifyActivity(content, activity01).find((result) => result.id === 'title')
  assert.equal(title?.passed, false)
  assert.match(title?.feedback ?? '', /Título 1/)
})

test('compara similaridade com o melhor parágrafo dentro de um documento maior', () => {
  const activity = { ...activity01, requirements: [{ id: 'text', type: 'text-content' as const, text: 'O planejamento ajuda a organizar ideias antes de escrever.', matchMode: 'similarity' as const, similarityThreshold: 0.95, points: 100, label: 'Texto', objective: 'Digitar texto.' }] }
  const content: JSONContent = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Meu documento' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'O planejamento ajuda a organizar ideias antes de escrever.' }] },
    { type: 'orderedList', content: [listItem('Planejar'), listItem('Escrever'), listItem('Revisar')] },
  ] }
  assert.equal(verifyActivity(content, activity)[0].passed, true)
})

test('aceita qualquer heading, alinhamento e lista que satisfaça o requisito', () => {
  const content: JSONContent = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Preservação Ambiental' }] },
    { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Preservação Ambiental' }] },
    { type: 'orderedList', content: [listItem('Um'), listItem('Dois')] },
    { type: 'orderedList', content: [listItem('Um'), listItem('Dois'), listItem('Três')] },
  ] }
  const result = resultsFor(content)
  assert.equal(result.title, true)
  assert.equal(result.alignment, true)
  assert.equal(result.list, true)
})
