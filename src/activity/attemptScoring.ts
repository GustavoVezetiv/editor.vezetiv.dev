import type { ActivityAttempt, VerificationRun } from "../types/platform";

export interface AttemptScoreState {
  currentScore: number;
  scoreReachedAt?: string;
}

export function bestVerificationRun(
  attempt: Pick<ActivityAttempt, "verificationRuns">,
): VerificationRun | undefined {
  return [...attempt.verificationRuns].sort(
    (a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt),
  )[0];
}

export function bestAttemptScore(
  attempt: Pick<ActivityAttempt, "currentScore" | "verificationRuns">,
): number {
  return Math.max(
    attempt.currentScore,
    bestVerificationRun(attempt)?.score ?? 0,
  );
}

export function completionScore(
  attempt: Pick<ActivityAttempt, "currentScore">,
): number {
  return attempt.currentScore;
}

export function scoreStateFromRuns(runs: VerificationRun[]): AttemptScoreState {
  if (!runs.length) return { currentScore: 0 };
  const best = bestVerificationRun({ verificationRuns: runs })!;
  return { currentScore: best.score, scoreReachedAt: best.createdAt };
}

export function newlyPassedRequirementIds(
  attempt: ActivityAttempt,
  run: VerificationRun,
): string[] {
  const recorded = new Set(
    attempt.events
      .filter((event) => event.type === "requirement_passed")
      .map((event) => String(event.metadata.requirementId ?? "")),
  );
  return run.results
    .filter((result) => result.passed && !recorded.has(result.id))
    .map((result) => result.id);
}
