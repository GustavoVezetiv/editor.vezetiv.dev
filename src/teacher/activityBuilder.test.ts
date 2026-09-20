import assert from 'node:assert/strict'
import test from 'node:test'
import { activity02 } from '../config/activity01'
import { duplicateActivity } from './activityBuilderModel'

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
