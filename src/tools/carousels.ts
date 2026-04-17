import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ─── Types ────────────────────────────────────────────────
interface CarouselSlide {
  id: string;
  templateId: string;
  label: string;
  category: 'cover' | 'hook' | 'body' | 'cta';
  content: Record<string, unknown>;
  overrides: Record<string, unknown>;
}

interface CarouselRow {
  id: string;
  title: string;
  caption: string | null;
  slides: CarouselSlide[];
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────
function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ─── Slide input schema ───────────────────────────────────
const slideInputSchema = z.object({
  templateId: z
    .string()
    .min(1)
    .describe(
      'Template id — e.g. "cover-bold", "body-text", "body-quote", "body-numbered", "cta-question", "cta-save". Use list_carousels to discover template ids in use.'
    ),
  category: z
    .enum(['cover', 'hook', 'body', 'cta'])
    .describe('Slide role in the deck'),
  label: z.string().min(1).describe('Human-readable label (e.g. "커버", "본문 1", "CTA")'),
  content: z
    .record(z.unknown())
    .describe('Slide content fields (title/subtitle/body/items/etc. — shape depends on template)'),
  overrides: z
    .record(z.unknown())
    .optional()
    .describe('Style/brand overrides (backgroundColor, accentColor, etc.)'),
});

// ─── Registration ─────────────────────────────────────────
export function registerCarouselTools(
  server: McpServer,
  supabaseUrl: string,
  supabaseKey: string
): void {
  const sb: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  // ── list_carousels ─────────────────────────────────────
  server.tool(
    'list_carousels',
    'List carousels. Returns summary (id, title, caption, slide_count, timestamps). Use get_carousel for full slide data.',
    {
      limit: z.number().min(1).max(100).optional().describe('Max results (default 50)'),
      offset: z.number().min(0).optional().describe('Offset for pagination'),
    },
    async (params) => {
      try {
        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;
        const { data, error } = await sb
          .from('carousels')
          .select('id, title, caption, slides, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw new Error(error.message);

        const carousels = (data || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          caption: row.caption,
          slide_count: Array.isArray(row.slides) ? row.slides.length : 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        return ok({ carousels, count: carousels.length });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── get_carousel ───────────────────────────────────────
  server.tool(
    'get_carousel',
    'Get a single carousel by id (full slide data included).',
    {
      id: z.string().describe('Carousel id (e.g. "carousel-abc123")'),
    },
    async (params) => {
      try {
        const { data, error } = await sb
          .from('carousels')
          .select('*')
          .eq('id', params.id)
          .single();
        if (error) throw new Error(error.message);
        return ok({ carousel: data as CarouselRow });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── create_carousel ────────────────────────────────────
  server.tool(
    'create_carousel',
    [
      'Create a new carousel with the given slides.',
      'Each slide must include templateId, category, label, and content.',
      'Slide ids are auto-generated (e.g. "slide-abc123") — do not provide them.',
      'Typical structure: 1 cover slide + several body slides + 1 cta slide.',
    ].join(' '),
    {
      title: z.string().min(1).describe('Carousel title (shown in Studio listings)'),
      caption: z.string().optional().describe('Optional social-post caption draft'),
      slides: z
        .array(slideInputSchema)
        .min(1)
        .max(20)
        .describe('Ordered list of slides (at least 1, max 20)'),
    },
    async (params) => {
      try {
        const carouselId = uid('carousel');
        const slides: CarouselSlide[] = params.slides.map((s) => ({
          id: uid('slide'),
          templateId: s.templateId,
          category: s.category,
          label: s.label,
          content: s.content,
          overrides: s.overrides ?? {},
        }));

        const payload = {
          id: carouselId,
          title: params.title,
          caption: params.caption ?? null,
          slides,
        };

        const { data, error } = await sb
          .from('carousels')
          .insert(payload)
          .select()
          .single();
        if (error) throw new Error(error.message);

        const row = data as CarouselRow;
        return ok({
          message: 'Carousel created',
          carousel: {
            id: row.id,
            title: row.title,
            caption: row.caption,
            slide_count: row.slides.length,
            created_at: row.created_at,
          },
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ── update_carousel ────────────────────────────────────
  server.tool(
    'update_carousel',
    [
      'Update an existing carousel. Any of title, caption, or slides can be replaced.',
      'If slides are provided, they REPLACE the existing slides entirely (not merged).',
      'Each new slide gets a fresh auto-generated id unless one is explicitly passed.',
    ].join(' '),
    {
      id: z.string().describe('Carousel id to update'),
      title: z.string().optional().describe('New title'),
      caption: z.string().optional().describe('New caption (pass empty string to clear)'),
      slides: z
        .array(slideInputSchema.extend({ id: z.string().optional() }))
        .optional()
        .describe('New slides array (replaces existing slides entirely)'),
    },
    async (params) => {
      try {
        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (params.title !== undefined) update.title = params.title;
        if (params.caption !== undefined) update.caption = params.caption;
        if (params.slides) {
          update.slides = params.slides.map((s: any) => ({
            id: s.id || uid('slide'),
            templateId: s.templateId,
            category: s.category,
            label: s.label,
            content: s.content,
            overrides: s.overrides ?? {},
          }));
        }

        const { data, error } = await sb
          .from('carousels')
          .update(update)
          .eq('id', params.id)
          .select()
          .single();
        if (error) throw new Error(error.message);

        const row = data as CarouselRow;
        return ok({
          message: 'Carousel updated',
          carousel: {
            id: row.id,
            title: row.title,
            caption: row.caption,
            slide_count: row.slides.length,
            updated_at: row.updated_at,
          },
        });
      } catch (e) {
        return err(e);
      }
    }
  );
}
