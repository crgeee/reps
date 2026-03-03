import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import sql from '../../db/client.js';
import { generateQuestion } from '../../agent/questions.js';
import { evaluateAnswer } from '../../agent/evaluator.js';
import { dailyBriefing } from '../../agent/coach.js';
import type { Task, Note, Topic } from '../../../src/types.js';
import { logMcpAudit } from '../audit.js';

function checkScope(scopes: string[], required: string) {
  const msg = `MCP key missing required scope: ${required}`;
  if (!scopes.includes(required)) {
    return { isError: true as const, content: [{ type: 'text' as const, text: msg }] };
  }
  return null;
}

export function registerAgentTools(server: McpServer, userId: string, keyId: string, scopes: string[]): void {
  // --- generate-question ---
  server.registerTool(
    'generate-question',
    {
      title: 'Generate Interview Question',
      description:
        'Generate a realistic interview question for a task based on its topic and notes.',
      inputSchema: {
        taskId: z.string().uuid(),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ taskId }) => {
      const denied = checkScope(scopes, 'ai');
      if (denied) return denied;
      try {
        const [taskRow] = await sql`
          SELECT * FROM tasks WHERE id = ${taskId} AND user_id = ${userId}
        `;
        if (!taskRow) {
          return {
            isError: true as const,
            content: [{ type: 'text' as const, text: 'Task not found' }],
          };
        }

        const noteRows = await sql`
          SELECT * FROM notes WHERE task_id = ${taskId} ORDER BY created_at ASC
        `;

        const task: Task = {
          id: taskRow.id as string,
          topic: taskRow.topic as Topic,
          title: taskRow.title as string,
          completed: taskRow.completed as boolean,
          status: (taskRow.status as Task['status']) ?? 'todo',
          deadline: taskRow.deadline ? String(taskRow.deadline) : undefined,
          repetitions: taskRow.repetitions as number,
          interval: taskRow.interval as number,
          easeFactor: taskRow.ease_factor as number,
          nextReview: String(taskRow.next_review),
          lastReviewed: taskRow.last_reviewed ? String(taskRow.last_reviewed) : undefined,
          createdAt: String(taskRow.created_at),
          notes: noteRows.map(
            (n): Note => ({
              id: n.id as string,
              text: n.text as string,
              createdAt: String(n.created_at),
            }),
          ),
        };

        const question = await generateQuestion(task);

        await logMcpAudit(keyId, userId, 'generate-question', true);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(question, null, 2) }],
        };
      } catch (err) {
        await logMcpAudit(keyId, userId, 'generate-question', false, String(err));
        const message = err instanceof Error ? err.message : 'Failed to generate question';
        return {
          isError: true as const,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    },
  );

  // --- evaluate-answer ---
  server.registerTool(
    'evaluate-answer',
    {
      title: 'Evaluate Answer',
      description:
        'Evaluate a candidate answer for a task using AI. Saves feedback as a note on the task.',
      inputSchema: {
        taskId: z.string().uuid(),
        answer: z.string().min(1).max(10000),
      },
      annotations: {
        readOnlyHint: false,
      },
    },
    async ({ taskId, answer }) => {
      const denied = checkScope(scopes, 'ai');
      if (denied) return denied;
      try {
        // Verify task belongs to user before evaluating
        const [taskRow] = await sql`
          SELECT id FROM tasks WHERE id = ${taskId} AND user_id = ${userId}
        `;
        if (!taskRow) {
          return {
            isError: true as const,
            content: [{ type: 'text' as const, text: 'Task not found' }],
          };
        }

        const result = await evaluateAnswer(taskId, answer);

        await logMcpAudit(keyId, userId, 'evaluate-answer', true);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        await logMcpAudit(keyId, userId, 'evaluate-answer', false, String(err));
        const message = err instanceof Error ? err.message : 'Failed to evaluate answer';
        return {
          isError: true as const,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    },
  );

  // --- get-daily-briefing ---
  server.registerTool(
    'get-daily-briefing',
    {
      title: 'Get Daily Briefing',
      description:
        'Generate and return an AI-powered daily coaching briefing based on due reviews and upcoming deadlines.',
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const denied = checkScope(scopes, 'ai');
      if (denied) return denied;
      try {
        const message = await dailyBriefing(userId);

        await logMcpAudit(keyId, userId, 'get-daily-briefing', true);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(message, null, 2) }],
        };
      } catch (err) {
        await logMcpAudit(keyId, userId, 'get-daily-briefing', false, String(err));
        const errMessage = err instanceof Error ? err.message : 'Failed to generate briefing';
        return {
          isError: true as const,
          content: [{ type: 'text' as const, text: errMessage }],
        };
      }
    },
  );
}
