import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerActivityTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'get_activity_logs',
    'List activity logs with optional filters for collection, action, actor_type, and limit.',
    {
      collection: z.string().optional().describe('Filter by collection (contents, ideas, publications)'),
      action: z.enum(['create', 'update', 'delete', 'publish', 'revert', 'promote']).optional().describe('Filter by action type'),
      actor_type: z.enum(['agent', 'human']).optional().describe('Filter by actor type'),
      limit: z.number().min(1).max(100).optional().describe('Max results (default 50)'),
    },
    async (params) => {
      try {
        const logs = await adapter.getActivityLogs(params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ activity_logs: logs, count: logs.length }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );
}
