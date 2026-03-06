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
  overdue_urgency: number;
  deadline_pressure: number;
  difficulty: number;
  staleness: number;
  ai_weakness: number;
}

export interface PriorityResult {
  score: number;
  factors: PriorityFactors;
}

const WEIGHTS = {
  overdue_urgency: 0.3,
  deadline_pressure: 0.25,
  difficulty: 0.2,
  staleness: 0.15,
  ai_weakness: 0.1,
} as const;

/** Days between two date strings (positive = dateA is in the past). */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calculatePriorityScore(
  input: PriorityInput,
  aiScore?: AiScoreInput | null,
): PriorityResult {
  const now = today();

  // overdue_urgency: min(100, days_overdue * 15), 0 if not overdue
  const daysOverdue = daysBetween(input.nextReview, now);
  const overdue_urgency = daysOverdue > 0 ? Math.min(100, daysOverdue * 15) : 0;

  // deadline_pressure: max(0, 100 - days_until_deadline * 10), 0 if no deadline
  let deadline_pressure = 0;
  if (input.deadline !== null) {
    const daysUntil = daysBetween(now, input.deadline);
    deadline_pressure = Math.min(100, Math.max(0, 100 - daysUntil * 10));
  }

  // difficulty: min(100, (3.0 - easeFactor) / 1.7 * 100), EF 1.3 = 100, EF 3.0+ = 0
  const rawDifficulty = ((3.0 - input.easeFactor) / 1.7) * 100;
  const difficulty = Math.min(100, Math.max(0, rawDifficulty));

  // staleness: min(100, days_since_last_activity * 3.3)
  const lastActivity = input.lastReviewed ?? input.createdAt;
  const daysSinceActivity = daysBetween(lastActivity, now);
  const staleness = Math.min(100, Math.max(0, daysSinceActivity * 3.3));

  // ai_weakness: 100 - avgScore * 20, 0 if no AI data
  let ai_weakness = 0;
  if (aiScore) {
    ai_weakness = Math.max(0, 100 - aiScore.avgScore * 20);
  }

  const factors: PriorityFactors = {
    overdue_urgency,
    deadline_pressure,
    difficulty,
    staleness,
    ai_weakness,
  };

  const rawScore =
    factors.overdue_urgency * WEIGHTS.overdue_urgency +
    factors.deadline_pressure * WEIGHTS.deadline_pressure +
    factors.difficulty * WEIGHTS.difficulty +
    factors.staleness * WEIGHTS.staleness +
    factors.ai_weakness * WEIGHTS.ai_weakness;

  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  return { score, factors };
}
