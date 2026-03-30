import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerMediaTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'list_media',
    'List media items, ordered by most recent first.',
    {
      limit: z.number().min(1).max(100).optional().describe('Max results (default 50)'),
    },
    async (params) => {
      try {
        const media = await adapter.listMedia(params.limit);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ media, count: media.length }, null, 2),
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
    'create_media',
    'Register a media item in the CMS.',
    {
      filename: z.string().describe('Filename of the media'),
      url: z.string().describe('URL where the media is accessible'),
      mime_type: z.string().optional().describe('MIME type (e.g., image/png)'),
      file_size: z.number().optional().describe('File size in bytes'),
      width: z.number().optional().describe('Width in pixels'),
      height: z.number().optional().describe('Height in pixels'),
      storage_path: z.string().optional().describe('Storage path (e.g., S3 key)'),
      alt_text: z.string().optional().describe('Alt text for accessibility'),
      caption: z.string().optional().describe('Caption for the media'),
      created_by: z.string().optional().describe('Who uploaded this media'),
    },
    async (params) => {
      try {
        const media = await adapter.createMedia(params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ message: 'Media created', media }, null, 2),
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
