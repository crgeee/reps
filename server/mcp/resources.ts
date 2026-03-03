import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import sql from '../db/client.js';

const TOPICS = [
  { value: 'coding', description: 'Data structures, algorithms, and coding problems' },
  { value: 'system-design', description: 'System architecture and scalability' },
  { value: 'behavioral', description: 'STAR-format behavioral questions' },
  { value: 'papers', description: 'Research papers and technical reading' },
  { value: 'custom', description: 'User-defined custom topics' },
] as const;

export function registerResources(server: McpServer, userId: string): void {
  // Static resource: list of valid topic categories
  server.resource(
    'topics',
    'reps://topics',
    {
      description: 'List of valid interview prep topic categories',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json' as const,
          text: JSON.stringify(TOPICS, null, 2),
        },
      ],
    }),
  );

  // Tool: get-stats — returns task statistics for the authenticated user
  server.tool(
    'get-stats',
    'Get task statistics: counts by topic, due today, overdue, and average ease factor',
    async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const [topicCounts, dueResult, overdueResult, avgResult] = await Promise.all([
          sql`
            SELECT topic, COUNT(*)::int AS count FROM tasks
            WHERE user_id = ${userId} GROUP BY topic
          `,
          sql`
            SELECT COUNT(*)::int AS count FROM tasks
            WHERE user_id = ${userId} AND next_review <= ${today} AND completed = false
          `,
          sql`
            SELECT COUNT(*)::int AS count FROM tasks
            WHERE user_id = ${userId} AND next_review < ${today} AND completed = false
          `,
          sql`
            SELECT COALESCE(AVG(ease_factor), 2.5)::float AS avg FROM tasks
            WHERE user_id = ${userId}
          `,
        ]);

        const stats = {
          topicCounts: Object.fromEntries(
            topicCounts.map((row) => [row.topic as string, row.count as number]),
          ),
          dueToday: (dueResult[0]?.count as number) ?? 0,
          overdue: (overdueResult[0]?.count as number) ?? 0,
          averageEaseFactor: (avgResult[0]?.avg as number) ?? 2.5,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error fetching stats: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
