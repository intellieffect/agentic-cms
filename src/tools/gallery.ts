import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

const KIND = z.enum(['landing', 'video', 'ad', 'image', 'carousel', 'case_study', 'other']);
const ASPECT = z.enum(['1:1', '16:9', '9:16', '4:5', '3:4']);
const STATUS = z.enum(['draft', 'published', 'archived']);
const VISIBILITY = z.enum(['internal', 'member', 'public']);
const ROLE = z.enum(['cover', 'gallery', 'detail', 'hero_video']);

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function registerGalleryTools(server: McpServer, adapter: CMSAdapter): void {
  // 1. list_gallery_items
  server.tool(
    'list_gallery_items',
    'List AWC Gallery items. Filter by status/kind/featured/visibility. Ordered by featured first, featured_rank asc, then published_at desc.',
    {
      status: STATUS.optional().describe("Lifecycle status filter (default: no filter)"),
      kind: KIND.optional().describe('Kind filter'),
      is_featured: z.boolean().optional().describe('Featured flag filter'),
      visibility: VISIBILITY.optional().describe('Visibility filter'),
      limit: z.number().min(1).max(100).optional().describe('Max results (default 50)'),
      offset: z.number().min(0).optional().describe('Pagination offset'),
    },
    async (params) => {
      try {
        const items = await adapter.listGalleryItems(params);
        return textResult({ items, count: items.length });
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // 2. create_gallery_item
  server.tool(
    'create_gallery_item',
    'Create a Gallery item (default status=draft, visibility=public). Use set_gallery_featured afterwards to pin to the landing carousel.',
    {
      slug: z.string().min(1).describe('Unique slug (/gallery/item/:slug)'),
      title: z.string().min(1),
      subtitle: z.string().optional(),
      summary: z.string().optional(),
      kind: KIND,
      cover_media_id: z.string().uuid().optional().describe('FK media.id for cover'),
      cover_aspect: ASPECT.optional().describe("Cover aspect hint (default '16:9')"),
      status: STATUS.optional().describe("Lifecycle status (default 'draft')"),
      visibility: VISIBILITY.optional().describe("Visibility (default 'public')"),
      tags: z.array(z.string()).optional().describe('Tags array (Phase 1 text[])'),
      duration_minutes: z.number().int().min(0).optional(),
      author: z.string().optional(),
      source_table: z.string().optional(),
      source_id: z.string().uuid().optional(),
      published_at: z.string().datetime().optional(),
    },
    async (params) => {
      try {
        const item = await adapter.createGalleryItem(params);
        return textResult({ message: 'Gallery item created', item });
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // 3. set_gallery_featured
  server.tool(
    'set_gallery_featured',
    'Pin/unpin a Gallery item to the landing featured carousel. Set is_featured and featured_rank (lower = earlier).',
    {
      id: z.string().uuid().describe('gallery_items.id'),
      is_featured: z.boolean().describe('true to pin, false to unpin'),
      featured_rank: z.number().int().optional().describe('Sort key (e.g. 10, 20, 30). Only when is_featured=true.'),
    },
    async (params) => {
      try {
        const item = await adapter.setGalleryFeatured(params);
        return textResult({ message: 'Gallery featured updated', item });
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // 4. update_gallery_item — meta + status/visibility 통합 patch
  server.tool(
    'update_gallery_item',
    'Patch a Gallery item. Any subset of: title, subtitle, summary, kind, status, visibility, cover_aspect, tags, author, duration_minutes, is_featured, featured_rank, cover_media_id. published_at/featured_at are auto-set when status flips to published or is_featured flips to true.',
    {
      id: z.string().uuid(),
      title: z.string().min(1).optional(),
      subtitle: z.string().nullable().optional(),
      summary: z.string().nullable().optional(),
      kind: KIND.optional(),
      cover_media_id: z.string().uuid().nullable().optional(),
      cover_aspect: ASPECT.optional(),
      status: STATUS.optional(),
      visibility: VISIBILITY.optional(),
      is_featured: z.boolean().optional(),
      featured_rank: z.number().int().nullable().optional(),
      tags: z.array(z.string()).optional(),
      author: z.string().nullable().optional(),
      duration_minutes: z.number().int().nullable().optional(),
    },
    async ({ id, ...patch }) => {
      try {
        const item = await adapter.updateGalleryItem(id, patch);
        return textResult({ message: 'Gallery item updated', item });
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // 5. delete_gallery_item — gallery_item_media는 cascade
  server.tool(
    'delete_gallery_item',
    'Hard-delete a Gallery item. gallery_item_media rows cascade. Underlying media rows + storage files are NOT deleted (other items may reference them).',
    { id: z.string().uuid() },
    async ({ id }) => {
      try {
        await adapter.deleteGalleryItem(id);
        return textResult({ message: 'Gallery item deleted', id });
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // 6. list_gallery_media
  server.tool(
    'list_gallery_media',
    'List gallery_item_media rows for an item, ordered by sort_order asc.',
    { item_id: z.string().uuid() },
    async ({ item_id }) => {
      try {
        const links = await adapter.listGalleryMedia(item_id);
        return textResult({ links, count: links.length });
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // 7. attach_gallery_media — media row을 item에 link
  server.tool(
    'attach_gallery_media',
    'Attach an existing media row to a gallery item with role + sort_order. role defaults to gallery.',
    {
      item_id: z.string().uuid(),
      media_id: z.string().uuid(),
      role: ROLE.optional().describe("Role (default 'gallery')"),
      sort_order: z.number().int().optional(),
    },
    async (params) => {
      try {
        const link = await adapter.attachGalleryMedia(params);
        return textResult({ message: 'Media attached', link });
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // 8. detach_gallery_media
  server.tool(
    'detach_gallery_media',
    'Remove a gallery_item_media link. Underlying media row is preserved.',
    { link_id: z.string().uuid() },
    async ({ link_id }) => {
      try {
        await adapter.detachGalleryMedia(link_id);
        return textResult({ message: 'Media detached', link_id });
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // 9. set_gallery_cover — cover_media_id만 갱신 (link도 함께 만들지 않음)
  server.tool(
    'set_gallery_cover',
    'Set gallery_items.cover_media_id. Use attach_gallery_media separately if you also want a gallery_item_media row with role=cover.',
    {
      item_id: z.string().uuid(),
      media_id: z.string().uuid(),
    },
    async ({ item_id, media_id }) => {
      try {
        const item = await adapter.setGalleryCover(item_id, media_id);
        return textResult({ message: 'Gallery cover updated', item });
      } catch (e) {
        return errorResult(e);
      }
    }
  );
}
