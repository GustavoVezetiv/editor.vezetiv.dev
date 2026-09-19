import type { JSONContent } from '@tiptap/core'
import type { Activity, ActivityRequirement, DocumentPreset } from '../types/activity'

export interface CheckResult {
  id: string
  label: string
  passed: boolean
  points: number
  detail?: string
}

function getText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(getText).join('')
}

function walk(node: JSONContent, callback: (item: JSONContent) => void): void {
  callback(node)
  node.content?.forEach((child) => walk(child, callback))
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR')
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
      current[targetIndex] = Math.min(
        current[targetIndex - 1] + 1,
        previous[targetIndex] + 1,
        previous[targetIndex - 1] + (source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return 1 - previous[target.length] / Math.max(source.length, target.length)
}

function hasWholeWord(value: string, expected: string): boolean {
  const escaped = normalizeText(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(normalizeText(value))
}

function textRequirementResult(content: JSONContent, requirement: Extract<ActivityRequirement, { type: 'text-content' }>): { passed: boolean; detail?: string } {
  const actual = getText(content)
  if (requirement.matchMode === 'exact') return { passed: actual.includes(requirement.text) }
  if (requirement.matchMode === 'normalized') return { passed: normalizeText(actual).includes(normalizeText(requirement.text)) }
  const similarity = textSimilarity(actual, requirement.text)
  return { passed: similarity >= (requirement.similarityThreshold ?? 0.95), detail: `Texto: ${Math.round(similarity * 100)}% semelhante ao solicitado.` }
}

function passesRequirement(content: JSONContent, requirement: ActivityRequirement, preset?: DocumentPreset): boolean {
  if (requirement.type === 'text-content') {
    return textRequirementResult(content, requirement).passed
  }

  if (requirement.type === 'document-preset') return preset === requirement.preset
  if (requirement.type === 'spelling') return false

  if (requirement.type === 'heading') {
    let matched = false
    walk(content, (node) => {
      matched ||= node.type === 'heading'
        && node.attrs?.level === requirement.level
        && normalizeText(getText(node)) === normalizeText(requirement.text)
    })
    return matched
  }

  if (requirement.type === 'alignment') {
    let matched = false
    walk(content, (node) => {
      matched ||= (node.type === 'heading' || node.type === 'paragraph')
        && normalizeText(getText(node)) === normalizeText(requirement.target)
        && node.attrs?.textAlign === requirement.value
    })
    return matched
  }

  if (requirement.type === 'text-mark') {
    let matched = false
    walk(content, (node) => {
      if (node.type !== 'text' || !hasWholeWord(node.text ?? '', requirement.text)) return
      matched ||= node.marks?.some((mark) => mark.type === requirement.mark) ?? false
    })
    return matched
  }

  let matched = false
  walk(content, (node) => {
    matched ||= node.type === (requirement.type === 'ordered-list' ? 'orderedList' : 'bulletList')
      && (node.content?.filter((item) => item.type === 'listItem').length ?? 0) >= requirement.minItems
  })
  return matched
}

export function verifyActivity(content: JSONContent, activity: Activity, preset?: DocumentPreset): CheckResult[] {
  return activity.requirements.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    passed: passesRequirement(content, requirement, preset),
    points: requirement.points,
    detail: requirement.type === 'text-content' ? textRequirementResult(content, requirement).detail : undefined,
  }))
}
