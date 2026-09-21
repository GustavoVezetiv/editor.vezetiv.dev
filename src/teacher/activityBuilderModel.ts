import type { Activity } from '../types/activity'

const slugify = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function duplicateActivity(source: Activity): Activity {
  const suffix = crypto.randomUUID()
  return { ...structuredClone(source), id: `atividade-${suffix}`, slug: `${slugify(source.title)}-copia-${suffix.slice(0, 6)}`, title: `${source.title} (cópia)`, status: 'draft' }
}

export function prepareActivityForSave(draft: Activity): Activity {
  const suffix = crypto.randomUUID()
  return { ...structuredClone(draft), id: `atividade-${suffix}`, slug: `${slugify(draft.title)}-${suffix.slice(0, 6)}`, scoring: { totalPoints: draft.requirements.reduce((sum, requirement) => sum + requirement.points, 0) } }
}

export function createRequirement(type: Exclude<Activity['requirements'][number]['type'], 'spelling'>): Activity['requirements'][number] {
  const base = { id: `requisito-${crypto.randomUUID()}`, label: 'Novo requisito', objective: 'Descreva o objetivo.', points: 10 }
  if (type === 'heading') return { ...base, type, level: 1, text: 'Título' }
  if (type === 'alignment') return { ...base, type, target: 'Título', value: 'center' }
  if (type === 'text-mark') return { ...base, type, text: 'palavra', mark: 'bold' }
  if (type === 'text-content') return { ...base, type, text: 'Texto solicitado', matchMode: 'normalized' }
  if (type === 'ordered-list' || type === 'bullet-list') return { ...base, type, minItems: 3 }
  return { ...base, type: 'document-preset', preset: 'normal' }
}

export function changeRequirementType(requirement: Activity['requirements'][number], type: Exclude<Activity['requirements'][number]['type'], 'spelling'>): Activity['requirements'][number] {
  return { ...createRequirement(type), id: requirement.id, label: requirement.label, objective: requirement.objective, points: requirement.points }
}
