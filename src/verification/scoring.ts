import type { Activity } from '../types/activity'
import type { CheckResult } from './verifyActivity'

export interface ActivityScore {
  earnedPoints: number
  totalPoints: number
}

export function calculateScore(activity: Activity, results: CheckResult[]): ActivityScore {
  const earnedPoints = results.reduce((total, result) => total + (result.passed ? result.points : 0), 0)
  const configuredTotal = activity.scoring.totalPoints
  const requirementsTotal = activity.requirements.reduce((total, requirement) => total + requirement.points, 0)

  return {
    earnedPoints,
    totalPoints: configuredTotal || requirementsTotal,
  }
}
