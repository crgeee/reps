import { Hono } from 'hono';
import { StreamableHTTPTransport } from '@hono/mcp';
import { bodyLimit } from 'hono/body-limit';
import { createMcpServer } from './server.js';
import { mcpAuthMiddleware } from '../middleware/mcp-auth.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { logger } from '../logger.js';

type McpEnv = {
  Variables: { userId: string; mcpKeyId: string; mcpScopes: string[] };
};

const mcp = new Hono<McpEnv>();

// MCP-specific middleware
mcp.use('/*', mcpAuthMiddleware);
mcp.use('/*', bodyLimit({ maxSize: 100 * 1024 })); // 100KB
mcp.use('/*', rateLimiter(60, 60_000)); // 60 req/min

// POST /mcp — handle MCP JSON-RPC requests (stateless: fresh server per request)
mcp.post('/', async (c) => {
  const userId = c.get('userId');
  const keyId = c.get('mcpKeyId');
  const scopes = c.get('mcpScopes');
  const server = createMcpServer(userId, keyId, scopes);

  // Stateless mode: no session IDs, JSON responses
  const transport = new StreamableHTTPTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(c);
  } catch (err) {
    logger.error({ err }, 'MCP request handling error');
    return c.json({ error: 'Internal MCP error' }, 500);
  } finally {
    try {
      await server.close();
    } catch {
      // server may already be closed
    }
  }
});

// GET and DELETE — not supported in stateless mode
mcp.get('/', (c) => c.json({ error: 'Method not allowed. Use POST for MCP requests.' }, 405));
mcp.delete('/', (c) => c.json({ error: 'Method not allowed. Sessions not supported.' }, 405));

export default mcp;
