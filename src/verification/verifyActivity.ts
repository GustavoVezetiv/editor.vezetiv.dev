import type { JSONContent } from '@tiptap/core'
import type { Activity, ActivityRequirement, DocumentPreset } from '../types/activity'

export interface CheckResult {
  id: string
  label: string
  passed: boolean
  points: number
  detail?: string
  feedback?: string
}

interface RequirementEvaluation { passed: boolean; detail?: string; feedback?: string }
type RequirementHandler = (content: JSONContent, requirement: never, preset?: DocumentPreset) => RequirementEvaluation

function getText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(getText).join('')
}

function walk(node: JSONContent, callback: (item: JSONContent) => void): void {
  callback(node)
  node.content?.forEach((child) => walk(child, callback))
}

function findNode(content: JSONContent, predicate: (node: JSONContent) => boolean): JSONContent | undefined {
  let found: JSONContent | undefined
  walk(content, (node) => { if (!found && predicate(node)) found = node })
  return found
}

function findNodes(content: JSONContent, predicate: (node: JSONContent) => boolean): JSONContent[] {
  const found: JSONContent[] = []
  walk(content, (node) => { if (predicate(node)) found.push(node) })
  return found
}

export function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR')
}

export function textSimilarity(actual: string, expected: string): number {
  const source = normalizeText(actual)
  const target = normalizeText(expected)
  if (!source && !target) return 1
  if (!source || !target) return 0
  const previous = Array.from({ length: target.length + 1 }, (_, index) => index)
  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    const current = [sourceIndex]
    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      current[targetIndex] = Math.min(current[targetIndex - 1] + 1, previous[targetIndex] + 1, previous[targetIndex - 1] + (source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1))
    }
    previous.splice(0, previous.length, ...current)
  }
  return 1 - previous[target.length] / Math.max(source.length, target.length)
}

function hasWholeWord(value: string, expected: string): boolean {
  const escaped = normalizeText(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(normalizeText(value))
}

const handlers: Record<ActivityRequirement['type'], RequirementHandler> = {
  'text-content': (content, rawRequirement) => {
    const requirement = rawRequirement as Extract<ActivityRequirement, { type: 'text-content' }>
    const candidates = findNodes(content, (node) => node.type === 'paragraph' || node.type === 'heading').map(getText).filter(Boolean)
    if (requirement.matchMode === 'exact') return { passed: candidates.some((candidate) => candidate.includes(requirement.text)), feedback: 'Digite o texto solicitado e confira a escrita.' }
    if (requirement.matchMode === 'normalized') return { passed: candidates.some((candidate) => normalizeText(candidate).includes(normalizeText(requirement.text))), feedback: 'O texto solicitado ainda não foi reconhecido. Revise se todas as palavras foram digitadas.' }
    const similarity = candidates.reduce((best, candidate) => Math.max(best, textSimilarity(candidate, requirement.text)), 0)
    return { passed: similarity >= (requirement.similarityThreshold ?? 0.95), detail: `Texto: ${Math.round(similarity * 100)}% semelhante ao solicitado.`, feedback: 'Revise o texto para aproximá-lo do enunciado.' }
  },
  heading: (content, rawRequirement) => {
    const requirement = rawRequirement as Extract<ActivityRequirement, { type: 'heading' }>
    const matchingHeading = findNode(content, (node) => node.type === 'heading' && node.attrs?.level === requirement.level && normalizeText(getText(node)) === normalizeText(requirement.text))
    const matchingText = findNode(content, (node) => (node.type === 'heading' || node.type === 'paragraph') && normalizeText(getText(node)) === normalizeText(requirement.text))
    return { passed: Boolean(matchingHeading), feedback: matchingText ? `O texto foi encontrado, mas ainda precisa usar o estilo Título ${requirement.level}.` : `Digite o título “${requirement.text}”.` }
  },
  alignment: (content, rawRequirement) => {
    const requirement = rawRequirement as Extract<ActivityRequirement, { type: 'alignment' }>
    const matchingTexts = findNodes(content, (node) => (node.type === 'heading' || node.type === 'paragraph') && normalizeText(getText(node)) === normalizeText(requirement.target))
    return { passed: matchingTexts.some((node) => node.attrs?.textAlign === requirement.value), feedback: matchingTexts.length ? `O texto existe, mas ainda não está alinhado à ${requirement.value === 'center' ? 'centralização' : requirement.value}.` : `Primeiro localize ou digite “${requirement.target}”.` }
  },
  'text-mark': (content, rawRequirement) => {
    const requirement = rawRequirement as Extract<ActivityRequirement, { type: 'text-mark' }>
    let foundText = false
    let passed = false
    walk(content, (node) => {
      if (node.type !== 'text' || !hasWholeWord(node.text ?? '', requirement.text)) return
      foundText = true
      passed ||= node.marks?.some((mark) => mark.type === requirement.mark) ?? false
    })
    const markLabel = requirement.mark === 'bold' ? 'negrito' : requirement.mark === 'italic' ? 'itálico' : 'sublinhado'
    return { passed, feedback: foundText ? `A palavra foi encontrada, mas ainda não está em ${markLabel}.` : `Digite a palavra “${requirement.text}” antes de aplicar ${markLabel}.` }
  },
  'ordered-list': (content, rawRequirement) => {
    const requirement = rawRequirement as Extract<ActivityRequirement, { type: 'ordered-list' }>
    const count = findNodes(content, (node) => node.type === 'orderedList').reduce((best, list) => Math.max(best, list.content?.filter((item) => item.type === 'listItem').length ?? 0), 0)
    return { passed: count >= requirement.minItems, detail: `${count} de ${requirement.minItems} itens encontrados.`, feedback: count ? `A lista ainda precisa de ${requirement.minItems - count} item(ns).` : 'Use a ferramenta de lista numerada; uma numeração digitada manualmente não conta.' }
  },
  'bullet-list': (content, rawRequirement) => {
    const requirement = rawRequirement as Extract<ActivityRequirement, { type: 'bullet-list' }>
    const count = findNodes(content, (node) => node.type === 'bulletList').reduce((best, list) => Math.max(best, list.content?.filter((item) => item.type === 'listItem').length ?? 0), 0)
    return { passed: count >= requirement.minItems, detail: `${count} de ${requirement.minItems} itens encontrados.`, feedback: count ? `A lista ainda precisa de ${requirement.minItems - count} item(ns).` : 'Use a ferramenta de lista com marcadores, em vez de digitar símbolos manualmente.' }
  },
  'document-preset': (_content, rawRequirement, preset) => {
    const requirement = rawRequirement as Extract<ActivityRequirement, { type: 'document-preset' }>
    return { passed: preset === requirement.preset, feedback: `Selecione o padrão ${requirement.preset === 'normal' ? 'Normal' : 'Acadêmico (ABNT)'} no menu do documento.` }
  },
  spelling: () => ({ passed: false, feedback: 'A verificação ortográfica automática ainda não está configurada para esta atividade.' }),
}

export function verifyActivity(content: JSONContent, activity: Activity, preset?: DocumentPreset): CheckResult[] {
  return activity.requirements.map((requirement) => {
    const evaluation = handlers[requirement.type](content, requirement as never, preset)
    return { id: requirement.id, label: requirement.label, points: requirement.points, ...evaluation }
  })
}
