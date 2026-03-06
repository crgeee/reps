export interface PriorityInput {
  nextReview: string;
  deadline: string | null;
  easeFactor: number;
  lastReviewed: string | null;
  createdAt: string;
}

export interface AiScoreInput {
  avgScore: number;
}

export interface PriorityFactors {
  overdueUrgency: number;
  deadlinePressure: number;
  difficulty: number;
  staleness: number;
  aiWeakness: number;
}

export interface PriorityResult {
  readonly score: number;
  readonly factors: Readonly<PriorityFactors>;
}

const WEIGHTS: Record<keyof PriorityFactors, number> = {
  overdueUrgency: 0.3,
  deadlinePressure: 0.25,
  difficulty: 0.2,
  staleness: 0.15,
  aiWeakness: 0.1,
};

/** Days between two date strings (positive = dateA is in the past). */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function calculatePriorityScore(
  input: PriorityInput,
  aiScore?: AiScoreInput | null,
  nowOverride?: string,
): PriorityResult {
  const now = nowOverride ?? today();

  if (!DATE_RE.test(input.nextReview) || !DATE_RE.test(input.createdAt)) {
    return {
      score: 0,
      factors: {
        overdueUrgency: 0,
        deadlinePressure: 0,
        difficulty: 0,
        staleness: 0,
        aiWeakness: 0,
      },
    };
  }

  // overdueUrgency: min(100, days_overdue * 15), 0 if not overdue
  const daysOverdue = daysBetween(input.nextReview, now);
  const overdueUrgency = daysOverdue > 0 ? Math.min(100, daysOverdue * 15) : 0;

  // deadlinePressure: max(0, 100 - days_until_deadline * 10), 0 if no deadline
  let deadlinePressure = 0;
  if (input.deadline !== null && DATE_RE.test(input.deadline)) {
    const daysUntil = daysBetween(now, input.deadline);
    deadlinePressure = Math.min(100, Math.max(0, 100 - daysUntil * 10));
  }

  // difficulty: min(100, (3.0 - easeFactor) / 1.7 * 100), EF 1.3 = 100, EF 3.0+ = 0
  const rawDifficulty = ((3.0 - input.easeFactor) / 1.7) * 100;
  const difficulty = Math.min(100, Math.max(0, rawDifficulty));

  // staleness: min(100, days_since_last_activity * 3.3)
  const lastActivity = input.lastReviewed ?? input.createdAt;
  const daysSinceActivity = DATE_RE.test(lastActivity) ? daysBetween(lastActivity, now) : 0;
  const staleness = Math.min(100, Math.max(0, daysSinceActivity * 3.3));

  // aiWeakness: 100 - avgScore * 20, 0 if no AI data
  let aiWeakness = 0;
  if (aiScore) {
    aiWeakness = Math.max(0, 100 - aiScore.avgScore * 20);
  }

  const factors: PriorityFactors = {
    overdueUrgency,
    deadlinePressure,
    difficulty,
    staleness,
    aiWeakness,
  };

  const rawScore = Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + factors[key as keyof PriorityFactors] * weight,
    0,
  );

  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  return { score, factors };
}
