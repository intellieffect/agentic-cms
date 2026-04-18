import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

// 파이프라인 단계 2 — Discover.
//   Topics(1) → [Ideas(2)] → Contents(3) → Variants(4) → Derivatives/Distribution(5) → Publish(6)
//
// 에이전트가 Ideas 단계에서 하는 일:
//   a. list_ideas() 로 기존 수집분 확인
//   b. create_idea() 로 새 앵글 등록 (topic_id 연결 권장)
//   c. update_idea() 로 angle / target_audience 정제
//   d. promote_idea() 로 마스터 Content 초안 생성 → 파이프라인 다음 단계로

export function registerIdeaTools(server: McpServer, adapter: CMSAdapter): void {
  server.tool(
    'list_ideas',
    [
      '[Pipeline step 2 — Discover] List all content ideas, ordered by most recent first.',
      'Use this first to see what ideas already exist before creating new ones.',
      'Typical next step: create_idea (register new angle) or promote_idea (turn existing idea into draft Content).',
    ].join(' '),
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
    },
  );

  server.tool(
    'get_idea',
    '[Pipeline step 2 — Discover] Get a single idea by id. Useful when promote_idea or update_idea needs full context first.',
    {
      id: z.string().uuid().describe('Idea UUID'),
    },
    async (params) => {
      try {
        const idea = await adapter.getIdea(params.id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ idea }, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'create_idea',
    [
      '[Pipeline step 2 — Discover] Register a new content idea under a Topic.',
      'Use this when the agent discovers a new angle from research, competitor scan, user feedback, etc.',
      'Link to a Topic (list_topics first) to keep the pipeline organized.',
      'Typical next step: promote_idea(id, title, slug) — turns this idea into a draft Content (step 3).',
    ].join(' '),
    {
      raw_text: z.string().min(1).describe('The raw idea text / angle (1~2 sentences).'),
      source: z
        .string()
        .optional()
        .describe(
          'Where the idea came from — "manual", "agent", "exa_trend", "competitor_scan", etc. Default "agent".',
        ),
      topic_id: z
        .string()
        .uuid()
        .optional()
        .describe('Topic UUID the idea belongs to (call list_topics to discover ids).'),
      angle: z
        .string()
        .optional()
        .describe('Editorial angle (e.g. "case study", "how-to", "contrarian take").'),
      target_audience: z
        .string()
        .optional()
        .describe('Intended reader segment (e.g. "B2B SaaS PMs", "solo founders").'),
    },
    async (params) => {
      try {
        const idea = await adapter.createIdea(params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ message: 'Idea created', idea }, null, 2),
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
    },
  );

  server.tool(
    'update_idea',
    [
      '[Pipeline step 2 — Discover] Refine an idea (angle / target_audience / raw_text).',
      'Use this when the agent learns more context before promoting the idea to Content.',
      'Pass topic_id=null to explicitly un-link from a Topic.',
    ].join(' '),
    {
      id: z.string().uuid().describe('Idea UUID'),
      raw_text: z.string().optional(),
      source: z.string().optional(),
      topic_id: z.string().uuid().nullable().optional(),
      angle: z.string().nullable().optional(),
      target_audience: z.string().nullable().optional(),
    },
    async (params) => {
      try {
        const { id, ...rest } = params;
        const idea = await adapter.updateIdea(id, rest);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ message: 'Idea updated', idea }, null, 2),
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
    },
  );

  server.tool(
    'promote_idea',
    [
      '[Pipeline step 2→3 — Discover → Create] Promote an idea to a draft Content item.',
      'Creates a new Content (always status=draft; agents cannot publish directly) and links the original idea via ideas.promoted_to.',
      'Typical next step: update_content (edit hook/body/cta) → create_variant (step 4, derive per-platform).',
    ].join(' '),
    {
      idea_id: z.string().uuid().describe('ID of the idea to promote'),
      title: z.string().describe('Title for the new content'),
      slug: z.string().describe('URL-friendly slug for the new content'),
      category: z.string().optional().describe('Content category'),
      body_md: z.string().optional().describe('Initial body in Markdown'),
      tags: z.array(z.string()).optional().describe('Content tags'),
      hook: z.string().optional().describe('Attention-grabbing hook (first 1~2 lines readers see).'),
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
                2,
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
    },
  );
}
