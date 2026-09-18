import type { JSONContent } from '@tiptap/core'
import type { Activity, ActivityRequirement } from '../types/activity'

export interface CheckResult {
  id: string
  label: string
  passed: boolean
  hint?: string
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

function hasWholeWord(value: string, expected: string): boolean {
  const escaped = normalizeText(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(normalizeText(value))
}

function passesRequirement(content: JSONContent, requirement: ActivityRequirement): boolean {
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
    matched ||= node.type === 'orderedList'
      && (node.content?.filter((item) => item.type === 'listItem').length ?? 0) >= requirement.minItems
  })
  return matched
}

export function verifyActivity(content: JSONContent, activity: Activity): CheckResult[] {
  return activity.requirements.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    passed: passesRequirement(content, requirement),
    hint: requirement.type === 'heading'
      ? `Use “${requirement.text}” exatamente como Título ${requirement.level}.`
      : undefined,
  }))
}
