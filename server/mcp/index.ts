import { Hono } from 'hono';
import { StreamableHTTPTransport } from '@hono/mcp';
import { bodyLimit } from 'hono/body-limit';
import { createMcpServer } from './server.js';
import { mcpAuthMiddleware } from '../middleware/mcp-auth.js';
import { rateLimiter } from '../middleware/rate-limit.js';

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
  const server = createMcpServer(userId, keyId);

  // Stateless mode: no session IDs, JSON responses
  const transport = new StreamableHTTPTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(c);
  } finally {
    await server.close();
  }
});

// GET and DELETE — not supported in stateless mode
mcp.get('/', (c) =>
  c.json({ error: 'Method not allowed. Use POST for MCP requests.' }, 405),
);
mcp.delete('/', (c) =>
  c.json({ error: 'Method not allowed. Sessions not supported.' }, 405),
);

export default mcp;
