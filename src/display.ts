import chalk from 'chalk';
import type { Task, Topic } from './types.js';

const topicColors: Record<Topic, (s: string) => string> = {
  coding: chalk.cyan,
  'system-design': chalk.magenta,
  behavioral: chalk.yellow,
  papers: chalk.green,
  custom: chalk.white,
};

export function formatTopic(topic: Topic): string {
  return topicColors[topic](topic);
}

export function formatTask(task: Task): string {
  const status = task.completed ? chalk.green('done') : chalk.red('pending');
  const due =
    task.nextReview <= new Date().toISOString().split('T')[0]
      ? chalk.red.bold('DUE')
      : chalk.dim(task.nextReview);
  return `${chalk.dim(task.id.slice(0, 8))} ${formatTopic(task.topic)} ${task.title} [${status}] ${due}`;
}

export function formatDashboard(tasks: Task[]): string {
  const topics: Topic[] = ['coding', 'system-design', 'behavioral', 'papers', 'custom'];
  const lines: string[] = [chalk.bold('\n  reps dashboard\n')];

  for (const topic of topics) {
    const topicTasks = tasks.filter((t) => t.topic === topic);
    const done = topicTasks.filter((t) => t.completed).length;
    const total = topicTasks.length;
    const due = topicTasks.filter(
      (t) => !t.completed && t.nextReview <= new Date().toISOString().split('T')[0],
    ).length;

    if (total > 0) {
      const bar = '█'.repeat(done) + '░'.repeat(total - done);
      const dueStr = due > 0 ? chalk.red(` (${due} due)`) : '';
      lines.push(`  ${formatTopic(topic).padEnd(25)} ${bar} ${done}/${total}${dueStr}`);
    }
  }

  return lines.join('\n') + '\n';
}
