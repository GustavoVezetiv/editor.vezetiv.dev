import assert from 'node:assert/strict'
import test from 'node:test'
import { activity01 } from '../config/activity01'
import type { SavedActivity } from '../types/activity'
import { loadSavedActivity, saveActivity } from './storage'

const key = `editor-vezetiv:${activity01.id}`
const values = new Map<string, string>()
let shouldThrowOnWrite = false

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (storageKey: string) => values.get(storageKey) ?? null,
    setItem: (storageKey: string, value: string) => {
      if (shouldThrowOnWrite) throw new Error('Storage unavailable')
      values.set(storageKey, value)
    },
  },
})

test('ignora dados de armazenamento corrompidos ou estruturalmente inválidos', () => {
  values.set(key, '{conteúdo inválido')
  assert.equal(loadSavedActivity(activity01), null)

  values.set(key, JSON.stringify({ activityId: activity01.id, savedAt: '2026-01-01', content: 'não é documento' }))
  assert.equal(loadSavedActivity(activity01), null)
})

test('retorna o resultado de falha ao salvar sem deixar a aplicação lançar erro', () => {
  const savedActivity: SavedActivity = {
    attemptId: 'attempto-teste',
    activityId: activity01.id,
    activeDocumentId: 'documento-1',
    documents: [{
      id: 'documento-1',
      name: 'Documento 1',
      content: activity01.initialContent,
      preset: 'academic-abnt',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    savedAt: '2026-01-01T00:00:00.000Z',
  }

  shouldThrowOnWrite = true
  assert.equal(saveActivity(savedActivity), false)

  shouldThrowOnWrite = false
  assert.equal(saveActivity(savedActivity), true)
})

test('migra o autosave anterior para a primeira aba sem perder o conteúdo', () => {
  values.set(key, JSON.stringify({
    activityId: activity01.id,
    content: activity01.initialContent,
    savedAt: '2026-01-01T00:00:00.000Z',
  }))

  const restored = loadSavedActivity(activity01)
  assert.equal(restored?.documents.length, 1)
  assert.equal(restored?.documents[0].name, 'Documento 1')
  assert.equal(restored?.documents[0].preset, 'academic-abnt')
  assert.equal(restored?.attemptId, 'attempto-local-legado')
})

test('migra o workspace existente para uma tentativa local', () => {
  values.set(key, JSON.stringify({
    activityId: activity01.id,
    activeDocumentId: 'documento-1',
    documents: [{
      id: 'documento-1', name: 'Documento 1', content: activity01.initialContent,
      preset: 'normal', updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    savedAt: '2026-01-01T00:00:00.000Z',
  }))

  assert.equal(loadSavedActivity(activity01)?.attemptId, 'attempto-local-legado')
})
