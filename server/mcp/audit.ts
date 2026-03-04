import sql from '../db/client.js';
import { logger } from '../logger.js';

export async function logMcpAudit(
  keyId: string,
  userId: string,
  toolName: string,
  success: boolean,
  error?: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO mcp_audit_log (key_id, user_id, tool_name, success, error)
      VALUES (${keyId}, ${userId}, ${toolName}, ${success}, ${error ?? null})
    `;
  } catch (err) {
    logger.error({ err, keyId, toolName }, 'Failed to log MCP audit entry');
  }
}
