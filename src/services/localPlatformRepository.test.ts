import assert from 'node:assert/strict'
import test from 'node:test'
import { activity01 } from '../config/activity01'
import { localPlatformRepository } from './localPlatformRepository'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } })

test('cria tentativa, mantém identidade do aluno e calcula ranking local', () => {
  values.clear()
  const demo = localPlatformRepository.dashboard()
  assert.equal(demo.classes.length, 1)
  assert.equal(demo.students.length, 5)
  assert.equal(demo.activities.length, 3)
  const first = localPlatformRepository.join('DEMO', 'A01', 'Ana Silva')
  const same = localPlatformRepository.join('demo', 'a01', 'Outro nome')
  assert.equal(first.id, same.id)
  const attempt = localPlatformRepository.openAttempt(first.id, activity01)
  assert.equal(attempt.status, 'in-progress')
  localPlatformRepository.saveAttempt({ ...attempt, currentScore: 80 })
  const ranking = localPlatformRepository.ranking(activity01.id)
  const studentEntry = ranking.find((entry) => entry.student.id === first.id)
  assert.equal(studentEntry?.score, 80)
  assert.ok(studentEntry?.position)
})
