import assert from 'node:assert/strict'
import test from 'node:test'
import { activity01 } from '../config/activity01'
import { calculateScore } from './scoring'

test('soma somente os pontos dos requisitos atendidos', () => {
  const results = activity01.requirements.map((requirement, index) => ({
    id: requirement.id,
    label: requirement.label,
    points: requirement.points,
    passed: index === 0 || index === 3,
  }))

  assert.deepEqual(calculateScore(activity01, results), { earnedPoints: 35, totalPoints: 100 })
})
