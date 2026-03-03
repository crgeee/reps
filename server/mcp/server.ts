import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerAgentTools } from './tools/agent.js';
import { registerResources } from './resources.js';

export function createMcpServer(userId: string, keyId: string, scopes: string[]): McpServer {
  const server = new McpServer({
    name: 'reps',
    version: '1.0.0',
  });

  registerTaskTools(server, userId, keyId, scopes);
  registerAgentTools(server, userId, keyId, scopes);
  registerResources(server, userId);

  return server;
}
