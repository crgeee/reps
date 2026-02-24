#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { loadTasks, saveTask, deleteTask, addNote } from './store.js';
import { calculateSM2 } from './spaced-repetition.js';
import { formatTask, formatDashboard } from './display.js';
import type { Task, Topic, Quality } from './types.js';

const program = new Command();

program
  .name('reps')
  .description('AI-powered interview prep tracker')
  .version('1.0.0');

program
  .command('dashboard')
  .description('Show prep dashboard')
  .action(() => {
    const tasks = loadTasks();
    console.log(formatDashboard(tasks));
  });

program
  .command('add')
  .description('Add a new task')
  .requiredOption('-t, --topic <topic>', 'Topic: coding, system-design, behavioral, papers, custom')
  .requiredOption('--title <title>', 'Task title')
  .option('-d, --deadline <date>', 'Deadline (YYYY-MM-DD)')
  .option('-n, --note <text>', 'Initial note')
  .action((opts) => {
    const today = new Date().toISOString().split('T')[0];
    const task: Task = {
      id: uuidv4(),
      topic: opts.topic as Topic,
      title: opts.title,
      notes: opts.note ? [{ id: uuidv4(), text: opts.note, createdAt: today }] : [],
      completed: false,
      deadline: opts.deadline,
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReview: today,
      createdAt: today,
    };
    saveTask(task);
    console.log(chalk.green(`Added: ${task.title}`));
  });

program
  .command('list')
  .description('List all tasks')
  .option('-t, --topic <topic>', 'Filter by topic')
  .action((opts) => {
    let tasks = loadTasks();
    if (opts.topic) {
      tasks = tasks.filter((t) => t.topic === opts.topic);
    }
    if (tasks.length === 0) {
      console.log(chalk.dim('No tasks found.'));
      return;
    }
    tasks.forEach((t) => console.log(formatTask(t)));
  });

program
  .command('done <id>')
  .description('Mark task as completed')
  .action((id) => {
    const tasks = loadTasks();
    const task = tasks.find((t) => t.id.startsWith(id));
    if (!task) {
      console.log(chalk.red('Task not found.'));
      return;
    }
    task.completed = true;
    saveTask(task);
    console.log(chalk.green(`Completed: ${task.title}`));
  });

program
  .command('note <id> <text>')
  .description('Add a note to a task')
  .action((id, text) => {
    const tasks = loadTasks();
    const task = tasks.find((t) => t.id.startsWith(id));
    if (!task) {
      console.log(chalk.red('Task not found.'));
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    addNote(task.id, { id: uuidv4(), text, createdAt: today });
    console.log(chalk.green(`Note added to: ${task.title}`));
  });

program
  .command('review')
  .description('Review due tasks')
  .action(async () => {
    const tasks = loadTasks();
    const today = new Date().toISOString().split('T')[0];
    const due = tasks.filter((t) => !t.completed && t.nextReview <= today);

    if (due.length === 0) {
      console.log(chalk.green('No tasks due for review!'));
      return;
    }

    console.log(chalk.bold(`\n${due.length} task(s) due for review:\n`));

    const readline = await import('node:readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, resolve));

    for (const task of due) {
      console.log(`\n${formatTask(task)}`);
      if (task.notes.length > 0) {
        console.log(chalk.dim(`  Notes: ${task.notes[task.notes.length - 1].text}`));
      }

      const answer = await ask('  Rate (0-5, or s to skip): ');
      if (answer.toLowerCase() === 's') continue;

      const quality = parseInt(answer, 10) as Quality;
      if (isNaN(quality) || quality < 0 || quality > 5) {
        console.log(chalk.red('  Invalid rating, skipping.'));
        continue;
      }

      const result = calculateSM2(task, quality);
      Object.assign(task, result, { lastReviewed: today });
      saveTask(task);
      console.log(chalk.green(`  Next review: ${result.nextReview}`));
    }

    rl.close();
  });

program
  .command('delete <id>')
  .description('Delete a task')
  .action((id) => {
    const tasks = loadTasks();
    const task = tasks.find((t) => t.id.startsWith(id));
    if (!task) {
      console.log(chalk.red('Task not found.'));
      return;
    }
    deleteTask(task.id);
    console.log(chalk.green(`Deleted: ${task.title}`));
  });

program
  .command('status')
  .description('Show review status')
  .action(() => {
    const tasks = loadTasks();
    const today = new Date().toISOString().split('T')[0];
    const due = tasks.filter((t) => !t.completed && t.nextReview <= today);
    const overdue = tasks.filter((t) => !t.completed && t.nextReview < today);
    console.log(`Total: ${tasks.length} | Due: ${due.length} | Overdue: ${overdue.length}`);
  });

program
  .command('info <id>')
  .description('Show task details')
  .action((id) => {
    const tasks = loadTasks();
    const task = tasks.find((t) => t.id.startsWith(id));
    if (!task) {
      console.log(chalk.red('Task not found.'));
      return;
    }
    console.log(`\n${chalk.bold(task.title)}`);
    console.log(`  Topic: ${task.topic}`);
    console.log(`  Status: ${task.completed ? 'done' : 'pending'}`);
    console.log(`  Ease: ${task.easeFactor} | Reps: ${task.repetitions} | Interval: ${task.interval}d`);
    console.log(`  Next review: ${task.nextReview}`);
    if (task.deadline) console.log(`  Deadline: ${task.deadline}`);
    if (task.notes.length > 0) {
      console.log(`  Notes:`);
      task.notes.forEach((n) => console.log(`    - ${n.text} (${n.createdAt})`));
    }
  });

program
  .command('seed')
  .description('Add sample tasks for testing')
  .action(() => {
    const today = new Date().toISOString().split('T')[0];
    const samples: Partial<Task>[] = [
      { topic: 'coding', title: 'Two Sum - hash map approach' },
      { topic: 'coding', title: 'LRU Cache implementation' },
      { topic: 'system-design', title: 'Design a URL shortener' },
      { topic: 'behavioral', title: 'Tell me about a time you led a technical decision' },
      { topic: 'papers', title: 'Constitutional AI paper' },
    ];
    for (const s of samples) {
      const task: Task = {
        id: uuidv4(),
        topic: s.topic as Topic,
        title: s.title!,
        notes: [],
        completed: false,
        repetitions: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReview: today,
        createdAt: today,
      };
      saveTask(task);
      console.log(chalk.green(`Seeded: ${task.title}`));
    }
  });

program.parse();
