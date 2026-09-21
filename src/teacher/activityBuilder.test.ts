import assert from 'node:assert/strict'
import test from 'node:test'
import { activity02 } from '../config/activity01'
import { changeRequirementType, createRequirement, duplicateActivity } from './activityBuilderModel'

test('duplicação preserva a configuração inteira e cria identidade de rascunho', () => {
  const copy = duplicateActivity(activity02)
  assert.notEqual(copy.id, activity02.id)
  assert.notEqual(copy.slug, activity02.slug)
  assert.equal(copy.status, 'draft')
  assert.deepEqual(copy.instructions, activity02.instructions)
  assert.deepEqual(copy.enabledTools, activity02.enabledTools)
  assert.deepEqual(copy.requirements, activity02.requirements)
  assert.deepEqual(copy.hints, activity02.hints)
  assert.equal(copy.pastePolicy, activity02.pastePolicy)
  assert.equal(copy.defaultDocumentPreset, activity02.defaultDocumentPreset)
})

test('adicionar, remover e adicionar requisito nunca reutiliza identidade', () => {
  const first = createRequirement('text-content')
  const second = createRequirement('heading')
  const remaining = [first, second].filter((item) => item.id !== first.id)
  const third = createRequirement('text-mark')
  assert.notEqual(first.id, second.id)
  assert.notEqual(first.id, third.id)
  assert.deepEqual([...remaining, third].map((item) => item.id), [second.id, third.id])
})

test('trocar tipo remove propriedades inválidas da união discriminada', () => {
  const text = createRequirement('text-content')
  const list = changeRequirementType(text, 'ordered-list')
  assert.equal(list.type, 'ordered-list')
  assert.equal(list.id, text.id)
  assert.equal('text' in list, false)
  assert.equal('matchMode' in list, false)
  assert.equal(list.minItems, 3)
})
