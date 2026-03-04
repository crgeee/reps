import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  tailLogs,
  searchLogs,
  getErrorSummary,
  getRequestTrace,
  getSlowRequests,
} from '../lib/log-reader.js';

const server = new McpServer({
  name: 'reps-logs',
  version: '1.0.0',
});

server.tool(
  'tail_logs',
  'Get the most recent log entries',
  {
    lines: z.number().int().min(1).max(500).default(50).describe('Number of entries to return'),
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional().describe('Minimum log level filter'),
  },
  async ({ lines, level }) => {
    const entries = await tailLogs(lines, level);
    return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
  },
);

server.tool(
  'search_logs',
  'Search log entries by text, level, date range, or path',
  {
    query: z.string().optional().describe('Text to search for in log messages'),
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional().describe('Minimum log level'),
    from: z.string().optional().describe('Start date (ISO 8601)'),
    to: z.string().optional().describe('End date (ISO 8601)'),
    path: z.string().optional().describe('Filter by request path (exact match)'),
    limit: z.number().int().min(1).max(1000).default(100).describe('Max entries to return'),
  },
  async (opts) => {
    const entries = await searchLogs(opts);
    return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
  },
);

server.tool(
  'error_summary',
  'Get aggregated error counts by message',
  {
    hours: z.number().int().min(1).max(720).default(24).describe('Look back period in hours'),
  },
  async ({ hours }) => {
    const summary = await getErrorSummary(hours);
    return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
  },
);

server.tool(
  'request_trace',
  'Get all log entries for a specific request ID',
  {
    requestId: z.string().uuid().describe('The X-Request-Id to trace'),
  },
  async ({ requestId }) => {
    const entries = await getRequestTrace(requestId);
    return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
  },
);

server.tool(
  'slow_requests',
  'Find requests above a latency threshold',
  {
    thresholdMs: z.number().int().min(1).default(1000).describe('Latency threshold in milliseconds'),
    limit: z.number().int().min(1).max(200).default(50).describe('Max entries to return'),
  },
  async ({ thresholdMs, limit }) => {
    const entries = await getSlowRequests(thresholdMs, limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('reps-logs MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal MCP server error:', err);
  process.exit(1);
});
