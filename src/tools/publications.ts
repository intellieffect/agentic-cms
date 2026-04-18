import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerPublicationTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'create_publication',
    '[Pipeline step 6 — Publish tracking] Record a publication event (where/when the content went out). Include variant_id so the Content detail view traces which variant was published on which channel. Final pipeline step — after this use get_metrics + get_activity_logs for feedback loop.',
    {
      content_id: z.string().uuid().describe('ID of the content that was published'),
      variant_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          'Optional variant that was actually published (recommended when a specific platform ' +
            'variant is being recorded — enables variant-level metric tracking).'
        ),
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
    '[Feedback loop] Get publication metrics for a content item — all publish events across channels. Use to learn which variants performed best before creating the next round of variants.',
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
