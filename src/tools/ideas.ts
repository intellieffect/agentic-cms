import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerIdeaTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'list_ideas',
    'List all content ideas, ordered by most recent first.',
    {},
    async () => {
      try {
        const ideas = await adapter.listIdeas();
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ ideas, count: ideas.length }, null, 2),
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
    'promote_idea',
    'Promote an idea to a draft content item. Creates a new content entry (always as draft) and links it to the original idea.',
    {
      idea_id: z.string().uuid().describe('ID of the idea to promote'),
      title: z.string().describe('Title for the new content'),
      slug: z.string().describe('URL-friendly slug for the new content'),
      category: z.string().optional().describe('Content category'),
      body_md: z.string().optional().describe('Initial body in Markdown'),
      tags: z.array(z.string()).optional().describe('Content tags'),
      hook: z.string().optional().describe('Attention-grabbing hook'),
      core_message: z.string().optional().describe('Core message or thesis'),
      media_type: z.string().optional().describe('Type of media'),
      funnel_stage: z.string().optional().describe('Marketing funnel stage'),
      cta: z.string().optional().describe('Call to action'),
    },
    async (params) => {
      try {
        const { idea_id, ...contentData } = params;
        const content = await adapter.promoteIdea(idea_id, contentData);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { message: 'Idea promoted to draft content', idea_id, content },
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
}
