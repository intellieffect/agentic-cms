import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

// video_projects 는 brxce-editor FastAPI(`/api/projects/save`) 경유로 만들어지므로
// create 시점에 variant_id 를 바로 넣을 수 없다. 대신 기존 레코드의 variant_id 를
// Supabase UPDATE 로 설정/해제하는 링크 전용 도구를 제공한다.
//
// 사용 시나리오:
//   1) 에이전트가 create_variant(content_id, format=video 또는 reel/short) → variant A 확보
//   2) 에이전트가 create_video_project(name, clips, ...) → video_project B (brxce-editor 경유)
//   3) link_video_project_to_variant(video_project_id=B, variant_id=A) → 연결
//
// 향후 brxce-editor 의 save 엔드포인트에 variant_id 가 추가되면 이 도구는 보조 유지.
export function registerVideoLinkTools(
  server: McpServer,
  adapter: CMSAdapter,
  supabaseUrl: string,
  supabaseKey: string,
): void {
  const sb: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  server.tool(
    'link_video_project_to_variant',
    [
      'Link (or unlink) an existing video_project to a variant (1:1).',
      'video_projects is currently created via the brxce-editor API which does not accept variant_id,',
      'so this tool fills the FK after creation.',
      'Pass variant_id=null to explicitly unlink.',
    ].join(' '),
    {
      video_project_id: z.string().uuid().describe('video_projects.id'),
      variant_id: z
        .string()
        .uuid()
        .nullable()
        .describe('variants.id to link to, or null to unlink (1:1 constraint).'),
    },
    async (params) => {
      try {
        const { data, error } = await sb
          .from('video_projects')
          .update({ variant_id: params.variant_id })
          .eq('id', params.video_project_id)
          .select('id, name, variant_id')
          .single();
        if (error) {
          if ((error as { code?: string }).code === '23505' && params.variant_id) {
            throw new Error(
              `variant_id ${params.variant_id} is already linked to another video_project (1:1 constraint).`,
            );
          }
          throw new Error(error.message);
        }

        // Best-effort audit log — 링크 자체를 별도 액션으로 기록.
        try {
          await adapter.logActivity({
            action: 'update',
            collection: 'video_projects',
            item_id: params.video_project_id,
            actor_type: 'agent',
            payload: { variant_id: params.variant_id },
          });
        } catch {
          // 감사 실패는 tool 실행을 막지 않는다.
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: params.variant_id ? 'Video project linked to variant.' : 'Video project unlinked.',
                  video_project: data,
                },
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
