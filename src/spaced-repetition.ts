import type { Quality, Task } from './types.js';

export interface SM2Result {
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: string;
}

export function calculateSM2(task: Task, quality: Quality): SM2Result {
  let { repetitions, interval, easeFactor } = task;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    repetitions,
    interval,
    easeFactor: Math.round(easeFactor * 100) / 100,
    nextReview: nextReview.toISOString().split('T')[0],
  };
}
