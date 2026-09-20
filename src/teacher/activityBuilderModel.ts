import type { Activity } from '../types/activity'

const slugify = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function duplicateActivity(source: Activity): Activity {
  const suffix = crypto.randomUUID()
  return { ...structuredClone(source), id: `atividade-${suffix}`, slug: `${slugify(source.title)}-copia-${suffix.slice(0, 6)}`, title: `${source.title} (cópia)`, status: 'draft', isFeatured: false }
}

export function prepareActivityForSave(draft: Activity): Activity {
  const suffix = crypto.randomUUID()
  return { ...structuredClone(draft), id: `atividade-${suffix}`, slug: `${slugify(draft.title)}-${suffix.slice(0, 6)}`, scoring: { totalPoints: draft.requirements.reduce((sum, requirement) => sum + requirement.points, 0) } }
}
