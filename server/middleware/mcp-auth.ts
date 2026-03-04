import type { MiddlewareHandler } from 'hono';
import sql from '../db/client.js';
import { validateMcpKey } from '../mcp/keys.js';
import { logger } from '../logger.js';

async function isMcpGloballyEnabled(): Promise<boolean> {
  const [row] = await sql<[{ value: unknown }?]>`
    SELECT value FROM server_settings WHERE key = 'mcp_enabled'
  `;
  // value is JSONB — postgres.js may return it as a boolean or as a JSON value
  return row?.value === true || row?.value === 'true';
}

async function isMcpEnabledForUser(userId: string): Promise<boolean> {
  const [row] = await sql<[{ mcp_enabled: boolean }?]>`
    SELECT mcp_enabled FROM users WHERE id = ${userId}
  `;
  return row?.mcp_enabled === true;
}

export const mcpAuthMiddleware: MiddlewareHandler<{
  Variables: { userId: string; mcpKeyId: string; mcpScopes: string[] };
}> = async (c, next) => {
  try {
    if (c.req.header('origin')) {
      return c.json({ error: 'Browser requests not permitted on MCP endpoint' }, 403);
    }

    if (!(await isMcpGloballyEnabled())) {
      return c.json({ error: 'MCP is currently disabled' }, 503);
    }

    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = header.slice(7);
    const result = await validateMcpKey(token);
    if (!result) {
      return c.json({ error: 'Invalid or expired MCP key' }, 401);
    }

    if (!(await isMcpEnabledForUser(result.userId))) {
      return c.json({ error: 'MCP is not enabled for your account' }, 403);
    }

    c.set('userId', result.userId);
    c.set('mcpKeyId', result.keyId);
    c.set('mcpScopes', result.scopes);

    return next();
  } catch (err) {
    logger.error({ err }, 'MCP auth middleware error');
    return c.json({ error: 'Authentication service unavailable' }, 503);
  }
};

export function requireScope(
  scope: string,
): MiddlewareHandler<{ Variables: { mcpScopes: string[] } }> {
  return async (c, next) => {
    const scopes = c.get('mcpScopes') as string[];
    if (!scopes.includes(scope)) {
      return c.json({ error: `MCP key missing required scope: ${scope}` }, 403);
    }
    return next();
  };
}
