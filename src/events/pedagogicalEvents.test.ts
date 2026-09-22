import assert from 'node:assert/strict'
import test from 'node:test'
import { createPedagogicalEvent } from './pedagogicalEvents'

test('cria evento pedagógico com identidade e metadados', () => {
  const event = createPedagogicalEvent({ activityId: 'activity-1', attemptId: 'attempt-1', documentId: 'document-1', type: 'format_applied', metadata: { tool: 'bold' } })
  assert.match(event.id, /^[\w-]+$/)
  assert.equal(event.metadata.tool, 'bold')
  assert.equal(event.type, 'format_applied')
})
