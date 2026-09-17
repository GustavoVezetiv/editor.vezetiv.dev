import type { JSONContent } from '@tiptap/core'
import type { Activity, CheckResult } from '../types/activity'

function getText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(getText).join('')
}

function walk(node: JSONContent, callback: (item: JSONContent) => void): void {
  callback(node)
  node.content?.forEach((child) => walk(child, callback))
}

function normalized(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR')
}

function isSustainabilityWord(value: string): boolean {
  return /(^|[^\p{L}\p{N}_])sustentabilidade(?=$|[^\p{L}\p{N}_])/iu.test(value)
}

export function verifyActivity(content: JSONContent, activity: Activity): CheckResult[] {
  let hasTitle = false
  let isTitleCentered = false
  let hasBoldSustainability = false
  let hasNumberedListWithThreeItems = false

  walk(content, (node) => {
    if (node.type === 'heading' && node.attrs?.level === 1 && normalized(getText(node)) === normalized(activity.expectedTitle)) {
      hasTitle = true
      isTitleCentered ||= node.attrs?.textAlign === 'center'
    }

    if (node.type === 'text' && isSustainabilityWord(node.text ?? '')) {
      hasBoldSustainability = node.marks?.some((mark) => mark.type === 'bold') ?? false
    }

    if (node.type === 'orderedList' && (node.content?.filter((item) => item.type === 'listItem').length ?? 0) >= 3) {
      hasNumberedListWithThreeItems = true
    }
  })

  return [
    { id: 'title', label: 'Título principal criado', passed: hasTitle },
    { id: 'alignment', label: 'Título centralizado', passed: hasTitle && isTitleCentered },
    { id: 'bold', label: '“sustentabilidade” está em negrito', passed: hasBoldSustainability },
    { id: 'list', label: 'Lista numerada com três itens', passed: hasNumberedListWithThreeItems },
  ]
}
