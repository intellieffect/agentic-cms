import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerTopicTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'list_topics',
    'List all topics, ordered by sort order.',
    {},
    async () => {
      try {
        const topics = await adapter.listTopics();
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ topics, count: topics.length }, null, 2),
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
    'create_topic',
    'Create a new topic with optional keywords, intent, and description.',
    {
      name: z.string().describe('Topic name'),
      keywords: z.array(z.string()).optional().describe('Topic keywords'),
      intent: z.string().optional().describe('Topic intent'),
      description: z.string().optional().describe('Topic description'),
    },
    async (params) => {
      try {
        const topic = await adapter.createTopic(params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ message: 'Topic created', topic }, null, 2),
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
