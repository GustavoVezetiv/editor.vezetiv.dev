import type { Activity } from '../types/activity'

export const activity01: Activity = {
  id: 'atividade-01-formatacao-basica',
  title: 'Atividade 01 — Formatação básica',
  description: 'Pratique operações comuns em editores de documentos.',
  instructions: [
    'Digite o título “Preservação Ambiental”.',
    'Transforme-o em título principal e centralize-o.',
    'Digite o pequeno parágrafo disponibilizado abaixo.',
    'Coloque a palavra “sustentabilidade” em negrito.',
    'Crie uma lista numerada com três itens.',
  ],
  sourceText:
    'A sustentabilidade depende de escolhas responsáveis no presente para preservar os recursos naturais no futuro.',
  initialContent: {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  },
  enabledTools: [
    'undo',
    'redo',
    'bold',
    'italic',
    'underline',
    'heading',
    'fontSize',
    'alignment',
    'bulletList',
    'orderedList',
  ],
  pastePolicy: 'blocked',
  requirements: [
    'Título principal “Preservação Ambiental”',
    'Título centralizado',
    '“sustentabilidade” em negrito',
    'Lista numerada com pelo menos três itens',
  ],
  expectedTitle: 'Preservação Ambiental',
}
