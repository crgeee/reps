import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTaskTools } from './tools/tasks.js';

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'reps',
    version: '1.0.0',
  });

  registerTaskTools(server, userId);
  // registerAgentTools(server, userId);  // Task 5
  // registerResources(server, userId);    // Task 6

  return server;
}
