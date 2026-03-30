import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerPublicationTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'create_publication',
    'Record a publication event — tracks where and when content was published, with optional metrics.',
    {
      content_id: z.string().uuid().describe('ID of the content that was published'),
      channel: z.string().describe('Publication channel (e.g., "blog", "twitter", "linkedin")'),
      channel_post_id: z.string().optional().describe('Platform-specific post ID'),
      url: z.string().url().optional().describe('URL where the content was published'),
      metrics: z.record(z.unknown()).optional().describe('Initial metrics (views, clicks, etc.)'),
    },
    async (params) => {
      try {
        const publication = await adapter.createPublication(params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { message: 'Publication recorded', publication },
                null,
                2
              ),
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

  server.tool(
    'get_metrics',
    'Get publication metrics for a specific content item — shows all publication events and their metrics.',
    {
      content_id: z.string().uuid().describe('Content ID to get metrics for'),
    },
    async (params) => {
      try {
        const metrics = await adapter.getMetrics(params.content_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(metrics, null, 2),
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
