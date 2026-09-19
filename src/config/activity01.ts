import type { Activity } from '../types/activity'

export const activity01: Activity = {
  id: 'atividade-01-formatacao-basica',
  slug: 'formatacao-basica',
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
  defaultDocumentPreset: 'academic-abnt',
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
      id: 'source-text', type: 'text-content', text: 'A sustentabilidade depende de escolhas responsáveis no presente para preservar os recursos naturais no futuro.', matchMode: 'normalized', points: 20,
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
  status: 'published',
  isFeatured: true,
}

export const activity02: Activity = {
  id: 'atividade-02-listas',
  slug: 'listas-e-destaques',
  title: 'Atividade 02 — Listas e destaques',
  description: 'Pratique uma lista com marcadores e o uso de itálico.',
  instructions: ['Digite a frase solicitada.', 'Coloque “planejamento” em itálico.', 'Crie uma lista com marcadores e três itens.'],
  sourceText: 'O planejamento ajuda a organizar ideias antes de escrever.',
  initialContent: { type: 'doc', content: [{ type: 'paragraph' }] },
  enabledTools: ['undo', 'redo', 'italic', 'bulletList'],
  pastePolicy: 'blocked',
  verificationMode: 'manual',
  defaultDocumentPreset: 'normal',
  requirements: [
    { id: 'source-text', type: 'text-content', text: 'O planejamento ajuda a organizar ideias antes de escrever.', matchMode: 'similarity', similarityThreshold: 0.95, points: 40, label: 'Texto solicitado digitado', objective: 'Digitar o texto solicitado.' },
    { id: 'italic', type: 'text-mark', text: 'planejamento', mark: 'italic', points: 25, label: '“planejamento” está em itálico', objective: 'Aplicar itálico em “planejamento”.' },
    { id: 'list', type: 'bullet-list', minItems: 3, points: 35, label: 'Lista com marcadores e três itens', objective: 'Criar uma lista com marcadores e três itens.' },
  ],
  hints: [
    { requirementId: 'source-text', title: 'Como inserir o texto?', steps: ['Leia o texto no painel.', 'Digite usando o teclado.', 'Revise antes de verificar.'] },
    { requirementId: 'italic', title: 'Como aplicar itálico?', steps: ['Selecione “planejamento”.', 'Clique em I na barra superior.'] },
    { requirementId: 'list', title: 'Como criar marcadores?', steps: ['Posicione o cursor.', 'Clique no botão de lista com marcadores.', 'Digite três itens, pressionando Enter entre eles.'] },
  ],
  scoring: { totalPoints: 100 },
  status: 'published',
  isFeatured: false,
}

export const builtInActivities = [activity01, activity02]
