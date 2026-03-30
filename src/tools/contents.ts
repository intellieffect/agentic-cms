import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerContentTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'list_contents',
    'List content items with optional filters for status, category, and tags.',
    {
      status: z.enum(['draft', 'review', 'published']).optional().describe('Filter by content status'),
      category: z.string().optional().describe('Filter by category'),
      tags: z.array(z.string()).optional().describe('Filter by tags (matches any)'),
      limit: z.number().min(1).max(100).optional().describe('Max results to return (default 50)'),
      offset: z.number().min(0).optional().describe('Offset for pagination'),
    },
    async (params) => {
      try {
        const contents = await adapter.listContents(params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ contents, count: contents.length }, null, 2),
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
    'get_content',
    'Get a single content item by its ID (UUID) or slug.',
    {
      id_or_slug: z.string().describe('Content ID (UUID) or slug'),
    },
    async (params) => {
      try {
        const content = await adapter.getContent(params.id_or_slug);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(content, null, 2) }],
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
    'create_content',
    'Create a new content item. Status is always set to "draft" regardless of input — agents cannot publish directly.',
    {
      title: z.string().describe('Content title'),
      slug: z.string().describe('URL-friendly slug (must be unique)'),
      category: z.string().optional().describe('Content category'),
      body_md: z.string().optional().describe('Content body in Markdown'),
      tags: z.array(z.string()).optional().describe('Content tags'),
      hook: z.string().optional().describe('Attention-grabbing hook'),
      core_message: z.string().optional().describe('Core message or thesis'),
      media_type: z.string().optional().describe('Type of media (video, image, etc.)'),
      media_urls: z.record(z.unknown()).optional().describe('Media URLs as key-value pairs'),
      funnel_stage: z.string().optional().describe('Marketing funnel stage'),
      cta: z.string().optional().describe('Call to action'),
      fact_checked: z.boolean().optional().describe('Whether content has been fact-checked'),
    },
    async (params) => {
      try {
        const content = await adapter.createContent(params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { message: 'Content created as draft', content },
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
    'update_content',
    'Update an existing content item. Cannot set status to "published" — that requires human approval.',
    {
      id: z.string().uuid().describe('Content ID (UUID)'),
      title: z.string().optional().describe('Updated title'),
      slug: z.string().optional().describe('Updated slug'),
      status: z.enum(['draft', 'review']).optional().describe('Updated status (cannot be "published")'),
      category: z.string().optional().describe('Updated category'),
      body_md: z.string().optional().describe('Updated body in Markdown'),
      tags: z.array(z.string()).optional().describe('Updated tags'),
      hook: z.string().optional().describe('Updated hook'),
      core_message: z.string().optional().describe('Updated core message'),
      media_type: z.string().optional().describe('Updated media type'),
      media_urls: z.record(z.unknown()).optional().describe('Updated media URLs'),
      funnel_stage: z.string().optional().describe('Updated funnel stage'),
      cta: z.string().optional().describe('Updated CTA'),
      fact_checked: z.boolean().optional().describe('Updated fact-check status'),
    },
    async (params) => {
      try {
        const { id, ...updateData } = params;
        const content = await adapter.updateContent(id, updateData);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ message: 'Content updated', content }, null, 2),
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
