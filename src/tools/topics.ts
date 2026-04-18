import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerTopicTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'list_topics',
    '[Pipeline step 1 — Strategy] List all topics (long-lived content themes). Start here: the agent picks which topic an idea belongs to. Typical next step: create_idea (step 2) under the chosen topic.',
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
    '[Pipeline step 1 — Strategy] Create a new topic. Topics are long-lived (3~5 total, rarely changed). Only add when a genuinely new content theme emerges.',
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
