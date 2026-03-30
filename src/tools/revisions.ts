import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

export function registerRevisionTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'get_revisions',
    'Get revision history for a content item.',
    {
      content_id: z.string().uuid().describe('Content ID to get revisions for'),
    },
    async (params) => {
      try {
        const revisions = await adapter.getRevisions(params.content_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ revisions, count: revisions.length }, null, 2),
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
    'revert_to_revision',
    'Revert a content item to a specific revision. Creates a new revision and logs the revert action.',
    {
      content_id: z.string().uuid().describe('Content ID to revert'),
      revision_id: z.string().uuid().describe('Revision ID to revert to'),
    },
    async (params) => {
      try {
        // Get the target revision
        const revisions = await adapter.getRevisions(params.content_id);
        const targetRevision = revisions.find((r) => r.id === params.revision_id);

        if (!targetRevision) {
          throw new Error(`Revision ${params.revision_id} not found for content ${params.content_id}`);
        }

        // Extract the snapshot data, removing fields that shouldn't be in the update
        const snapshot = { ...targetRevision.data };
        delete snapshot.id;
        delete snapshot.created_at;
        delete snapshot.updated_at;

        // Apply the revert via updateContent (which will auto-create revision + activity log)
        const content = await adapter.updateContent(
          params.content_id,
          snapshot as Record<string, unknown>,
        );

        // Log the revert action specifically
        await adapter.logActivity({
          action: 'revert',
          collection: 'contents',
          item_id: params.content_id,
          actor_type: 'agent',
          payload: {
            reverted_to_revision: params.revision_id,
            reverted_to_version: targetRevision.version_number,
          },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: `Reverted to version ${targetRevision.version_number}`,
                  content,
                },
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
