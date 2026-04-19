import { z } from 'zod';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSupabase } from '../shared/supabase.js';

// SEO meta_title 은 `META_TITLE_SUFFIX` env 로 workspace 별 suffix 붙일 수 있다.
// 예: META_TITLE_SUFFIX="AWC" → "{title} | AWC"
// 미설정 시 suffix 없이 title 만 사용.
function buildMetaTitle(title: string): string {
  const suffix = process.env.META_TITLE_SUFFIX?.trim();
  return suffix ? `${title} | ${suffix}` : title;
}

// Types for blog_posts table
interface BlogPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown[];
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  status: 'draft' | 'published' | 'archived';
  reading_time: number;
  ai_generated: boolean;
  thumbnail_url: string | null;
  thumbnail_alt: string | null;
  thumbnail_credit: string | null;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

const CLI_PATH = process.env.CONTENT_CORE_CLI_PATH;
const CLI_TIMEOUT_MS = Number(process.env.CONTENT_CORE_CLI_TIMEOUT_MS ?? 30_000);

function convertMarkdownToPlate(markdown: string, topic: string, category: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    if (!CLI_PATH) {
      reject(
        new Error(
          `CONTENT_CORE_CLI_PATH is not set. Set the env var to the absolute path of @awc/content-core dist/cli.js before invoking this tool.`
        )
      );
      return;
    }
    if (!existsSync(CLI_PATH)) {
      reject(
        new Error(
          `content-core CLI not found at ${CLI_PATH}. Build with 'pnpm --filter @awc/content-core build' or fix CONTENT_CORE_CLI_PATH.`
        )
      );
      return;
    }
    const args = [CLI_PATH, 'convert-plate', '--topic', topic, '--category', category];
    const child = spawn('node', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(() =>
        reject(new Error(`convert-plate CLI timed out after ${CLI_TIMEOUT_MS}ms (set CONTENT_CORE_CLI_TIMEOUT_MS to raise).`))
      );
    }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (e) => settle(() => reject(e)));
    child.on('close', (code) => {
      if (code !== 0) {
        settle(() => reject(new Error(`convert-plate exited ${code}: ${stderr}`)));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        settle(() => resolve(parsed));
      } catch (e) {
        settle(() =>
          reject(new Error(`Failed to parse convert-plate output: ${e instanceof Error ? e.message : String(e)}`))
        );
      }
    });
    child.stdin.write(markdown);
    child.stdin.end();
  });
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

export function registerBlogPostTools(server: McpServer): void {
  const sb = getSupabase();

  // ─── list_blog_categories ────────────────────────────────
  server.tool(
    'list_blog_categories',
    'List all blog post categories (name, slug, description). Use to find the correct category slug before creating a post.',
    {},
    async () => {
      try {
        const { data, error } = await sb.from('blog_categories').select('id, name, slug, description');
        if (error) throw new Error(error.message);
        return ok({ categories: data as BlogCategory[], count: (data || []).length });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ─── list_blog_posts ─────────────────────────────────────
  server.tool(
    'list_blog_posts',
    'List blog posts with optional filters. Returns summary fields (not full PlateJS content).',
    {
      status: z.enum(['draft', 'published', 'archived']).optional().describe('Filter by status'),
      category_slug: z.string().optional().describe('Filter by category slug (e.g. "case-study")'),
      limit: z.number().min(1).max(100).optional().describe('Max results (default 50)'),
    },
    async (params) => {
      try {
        let query = sb
          .from('blog_posts')
          .select(
            'id, title, slug, status, excerpt, reading_time, view_count, created_at, updated_at, published_at, blog_post_categories(blog_categories(id, name, slug))'
          )
          .order('created_at', { ascending: false })
          .limit(params.limit ?? 50);

        if (params.status) query = query.eq('status', params.status);

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        let posts = (data || []).map((row: any) => ({
          ...row,
          categories: (row.blog_post_categories || []).map((pc: any) => pc.blog_categories).filter(Boolean),
          blog_post_categories: undefined,
        }));

        if (params.category_slug) {
          posts = posts.filter((p: any) =>
            (p.categories || []).some((c: any) => c.slug === params.category_slug)
          );
        }

        return ok({ posts, count: posts.length });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ─── get_blog_post ───────────────────────────────────────
  server.tool(
    'get_blog_post',
    'Get a single blog post (including full PlateJS content) by ID or slug.',
    {
      id_or_slug: z.string().describe('Blog post UUID or slug'),
    },
    async (params) => {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id_or_slug);
        const { data, error } = await sb
          .from('blog_posts')
          .select(
            '*, blog_post_categories(blog_categories(id, name, slug)), blog_post_tags(blog_tags(id, name, slug))'
          )
          .eq(isUuid ? 'id' : 'slug', params.id_or_slug)
          .single();
        if (error) throw new Error(error.message);
        const post = {
          ...(data as any),
          categories: ((data as any)?.blog_post_categories || [])
            .map((pc: any) => pc.blog_categories)
            .filter(Boolean),
          tags: ((data as any)?.blog_post_tags || [])
            .map((pt: any) => pt.blog_tags)
            .filter(Boolean),
          blog_post_categories: undefined,
          blog_post_tags: undefined,
        };
        return ok({ post });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ─── create_blog_post_from_markdown ──────────────────────
  server.tool(
    'create_blog_post_from_markdown',
    [
      'Convert a Markdown body to PlateJS JSON and insert as a draft blog post.',
      'Status is ALWAYS "draft" — agents cannot publish directly; Studio review is required.',
      'Optionally links the post to an existing category by slug.',
      'Uses @awc/content-core CLI (convert-plate) for Markdown → PlateJS conversion.',
    ].join(' '),
    {
      title: z.string().describe('Post title'),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase-hyphen (English only)')
        .describe('URL-friendly English slug. Lowercase letters, digits, hyphens only.'),
      markdown_body: z.string().min(10).describe('Full blog post body in Markdown (will be converted to PlateJS)'),
      excerpt: z.string().optional().describe('Short summary (~100 chars, shown in listings)'),
      meta_title: z
        .string()
        .optional()
        .describe(
          'SEO meta_title. META_TITLE_SUFFIX env 가 있으면 default = "{title} | {suffix}", 없으면 {title} 만.',
        ),
      meta_description: z.string().optional().describe('SEO meta_description (~155 chars)'),
      meta_keywords: z.array(z.string()).optional().describe('SEO keyword array'),
      reading_time: z.number().int().min(1).max(60).optional().describe('Estimated reading time in minutes'),
      category_slug: z
        .string()
        .optional()
        .describe('Blog category slug (e.g. "case-study", "column"). Use list_blog_categories to discover.'),
      ai_generated: z
        .boolean()
        .optional()
        .describe('true if the agent generated the full text; false if human-written content'),
      thumbnail_url: z.string().url().optional().describe('Optional thumbnail image URL'),
      variant_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          'Optional variant(id) to link this blog_post to (1:1). Use the id returned by create_variant with format=blog. ' +
            'When set, the derivative appears on the Content detail Variants card automatically.'
        ),
    },
    async (params) => {
      try {
        // 1. Check slug uniqueness
        const { data: existing } = await sb
          .from('blog_posts')
          .select('id')
          .eq('slug', params.slug)
          .maybeSingle();
        if (existing) throw new Error(`Slug already exists: ${params.slug}`);

        // 2. Resolve category (optional)
        let categoryId: string | null = null;
        if (params.category_slug) {
          const { data: cat, error: catErr } = await sb
            .from('blog_categories')
            .select('id')
            .eq('slug', params.category_slug)
            .single();
          if (catErr || !cat) {
            throw new Error(`Category not found for slug: ${params.category_slug}`);
          }
          categoryId = (cat as { id: string }).id;
        }

        // 3. Convert markdown → PlateJS
        const plateContent = await convertMarkdownToPlate(
          params.markdown_body,
          params.title,
          params.category_slug || 'case-study'
        );

        // 4. Estimate reading_time if missing
        const readingTime =
          params.reading_time ??
          Math.max(1, Math.round(params.markdown_body.replace(/\s+/g, '').length / 500));

        // 5. Insert blog_posts row (always draft).
        //    variant_id 는 1:1 UNIQUE index 가 걸려있어 이미 다른 post 에 연결된 variant 를 재사용하면
        //    PostgreSQL 이 23505 (unique violation) 을 뱉는다. 그 경우는 친절한 메시지로 변환.
        const insertPayload: Record<string, unknown> = {
          title: params.title,
          slug: params.slug,
          excerpt: params.excerpt ?? null,
          content: plateContent,
          meta_title: params.meta_title ?? buildMetaTitle(params.title),
          meta_description: params.meta_description ?? null,
          meta_keywords: params.meta_keywords ?? [],
          status: 'draft' as const,
          reading_time: readingTime,
          ai_generated: params.ai_generated ?? false,
          thumbnail_url: params.thumbnail_url ?? null,
        };
        if (params.variant_id) insertPayload.variant_id = params.variant_id;

        const { data: inserted, error: insErr } = await sb
          .from('blog_posts')
          .insert(insertPayload)
          .select()
          .single();

        if (insErr || !inserted) {
          if (insErr && (insErr as { code?: string }).code === '23505' && params.variant_id) {
            throw new Error(
              `variant_id ${params.variant_id} is already linked to another blog_post (1:1 constraint). ` +
                `Create a new variant first, or use update_blog_post to re-link.`
            );
          }
          throw new Error(`Failed to insert blog_post: ${insErr?.message || 'unknown error'}`);
        }

        const post = inserted as BlogPostRow;

        // 6. Link category if provided. Roll back the blog_post insert on failure
        //    so we never leave an orphaned post (Supabase JS SDK has no multi-statement
        //    transaction — manual compensation is the safest option here).
        if (categoryId) {
          const { error: linkErr } = await sb
            .from('blog_post_categories')
            .insert({ post_id: post.id, category_id: categoryId });
          if (linkErr) {
            const { error: delErr } = await sb.from('blog_posts').delete().eq('id', post.id);
            const delNote = delErr
              ? ` (rollback also failed: ${delErr.message} — manual cleanup required for blog_post id=${post.id})`
              : ' (blog_post insert rolled back)';
            throw new Error(`Failed to link category: ${linkErr.message}${delNote}`);
          }
        }

        return ok({
          message: 'Blog post created as draft. Use Studio to review and publish.',
          post: {
            id: post.id,
            slug: post.slug,
            title: post.title,
            status: post.status,
            reading_time: post.reading_time,
            category_slug: params.category_slug ?? null,
            variant_id: params.variant_id ?? null,
            plate_nodes: plateContent.length,
          },
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ─── update_blog_post ────────────────────────────────────
  server.tool(
    'update_blog_post',
    [
      'Update fields on an existing blog post (title, excerpt, meta, thumbnail, or body).',
      'If markdown_body is provided, it will be converted to PlateJS and replace content.',
      'Status cannot be changed to "published" via this tool — use Studio for publishing.',
    ].join(' '),
    {
      id: z.string().uuid().describe('Blog post UUID'),
      title: z.string().optional(),
      excerpt: z.string().optional(),
      meta_title: z.string().optional(),
      meta_description: z.string().optional(),
      meta_keywords: z.array(z.string()).optional(),
      reading_time: z.number().int().min(1).max(60).optional(),
      thumbnail_url: z.string().url().optional(),
      status: z
        .enum(['draft', 'archived'])
        .optional()
        .describe('Status (cannot be "published"; use Studio for publishing)'),
      markdown_body: z
        .string()
        .optional()
        .describe('If provided, replaces content by converting markdown → PlateJS'),
      variant_id: z
        .string()
        .uuid()
        .nullable()
        .optional()
        .describe(
          'Link (or re-link) this blog_post to a variant. Pass null to explicitly unlink. ' +
            '1:1 — the target variant must not already be linked to another blog_post.'
        ),
    },
    async (params) => {
      try {
        const { id, markdown_body, ...rest } = params;
        const update: Record<string, unknown> = {
          ...rest,
          updated_at: new Date().toISOString(),
        };

        if (markdown_body) {
          // Need the current title for the conversion topic; fetch it.
          const { data: cur, error: curErr } = await sb
            .from('blog_posts')
            .select('title')
            .eq('id', id)
            .single();
          if (curErr || !cur) throw new Error(`Blog post not found: ${id}`);
          const topic = (update.title as string) || (cur as { title: string }).title;
          update.content = await convertMarkdownToPlate(markdown_body, topic, 'case-study');
        }

        const { data, error: upErr } = await sb
          .from('blog_posts')
          .update(update)
          .eq('id', id)
          .select()
          .single();
        if (upErr) {
          if ((upErr as { code?: string }).code === '23505' && params.variant_id) {
            throw new Error(
              `variant_id ${params.variant_id} is already linked to another blog_post (1:1 constraint).`
            );
          }
          throw new Error(upErr.message);
        }

        return ok({ message: 'Blog post updated', post: data });
      } catch (e) {
        return err(e);
      }
    }
  );
}
