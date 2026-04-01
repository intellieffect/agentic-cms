import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerVariantTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'list_variants',
    'List all variants for a content item.',
    {
      content_id: z.string().uuid().describe('Content ID to get variants for'),
    },
    async (params) => {
      try {
        const variants = await adapter.listVariants(params.content_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ variants, count: variants.length }, null, 2),
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
    'create_variant',
    'Create a platform-specific variant for a content item.',
    {
      content_id: z.string().uuid().describe('Content ID this variant belongs to'),
      platform: z.string().describe('Target platform'),
      format: z.string().describe('Target format'),
      body_text: z.string().optional().describe('Variant body text'),
      hashtags: z.array(z.string()).optional().describe('Variant hashtags'),
      character_count: z.number().optional().describe('Character count for the variant'),
      platform_settings: z.record(z.unknown()).optional().describe('Platform-specific settings'),
    },
    async (params) => {
      try {
        const variant = await adapter.createVariant(params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ message: 'Variant created', variant }, null, 2),
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
    'update_variant',
    'Update an existing variant.',
    {
      id: z.string().uuid().describe('Variant ID'),
      body_text: z.string().optional().describe('Updated body text'),
      hashtags: z.array(z.string()).optional().describe('Updated hashtags'),
      status: z.string().optional().describe('Updated status'),
      platform_settings: z.record(z.unknown()).optional().describe('Updated platform-specific settings'),
    },
    async (params) => {
      try {
        const { id, ...updateData } = params;
        const variant = await adapter.updateVariant(id, updateData);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ message: 'Variant updated', variant }, null, 2),
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
