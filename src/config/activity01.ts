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
  verificationMode: 'manual',
  documentPreset: 'academic-abnt',
  requirements: [
    {
      id: 'title', type: 'heading', level: 1, text: 'Preservação Ambiental', points: 20,
      label: 'Título principal “Preservação Ambiental”',
      objective: 'Criar o título “Preservação Ambiental” como Título 1.',
    },
    {
      id: 'alignment', type: 'alignment', target: 'Preservação Ambiental', value: 'center', points: 15,
      label: 'Título centralizado',
      objective: 'Centralizar o título.',
    },
    {
      id: 'source-text', type: 'text', text: 'A sustentabilidade depende de escolhas responsáveis no presente para preservar os recursos naturais no futuro.', points: 20,
      label: 'Texto solicitado digitado',
      objective: 'Digitar o texto solicitado.',
    },
    {
      id: 'bold', type: 'text-mark', text: 'sustentabilidade', mark: 'bold', points: 15,
      label: '“sustentabilidade” está em negrito',
      objective: 'Aplicar negrito em “sustentabilidade”.',
    },
    {
      id: 'list', type: 'ordered-list', minItems: 3, points: 30,
      label: 'Lista numerada com três itens',
      objective: 'Criar uma lista numerada com três itens.',
    },
  ],
  hints: [
    {
      requirementId: 'title', title: 'Como criar um título principal?',
      steps: ['Digite “Preservação Ambiental”.', 'Selecione o texto ou posicione o cursor nele.', 'No seletor de estilo, escolha “Título 1”.'],
    },
    {
      requirementId: 'alignment', title: 'Como centralizar o título?',
      steps: ['Posicione o cursor no título.', 'Localize o botão de centralizar na barra superior.', 'Clique nele para centralizar o parágrafo.'],
    },
    {
      requirementId: 'source-text', title: 'Como inserir o texto solicitado?',
      steps: ['Leia o texto exibido no painel da atividade.', 'Digite-o no documento usando o teclado.', 'Não use colagem: esta atividade foi planejada para praticar a digitação.'],
    },
    {
      requirementId: 'bold', title: 'Como aplicar negrito?',
      steps: ['Selecione apenas a palavra “sustentabilidade”.', 'Localize o botão N de negrito na barra superior.', 'Clique nele e confira se a palavra ficou destacada.'],
    },
    {
      requirementId: 'list', title: 'Como criar uma lista numerada?',
      steps: ['Posicione o cursor no local desejado.', 'Localize a ferramenta de lista numerada na barra superior.', 'Clique nela, digite o primeiro item e pressione Enter para criar os próximos.', 'Crie pelo menos três itens.'],
    },
  ],
  scoring: { totalPoints: 100 },
}
