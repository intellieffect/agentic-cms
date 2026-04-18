import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';
import { getSupabase } from '../shared/supabase.js';

// Postiz 연동 MCP 도구.
//
// Postiz 는 오픈소스 소셜 스케줄러. Instagram / LinkedIn / Threads / X(twitter) /
// YouTube / TikTok 등을 통합 관리. Public API v1 을 통해 MCP 에이전트가 직접 발행 가능.
//
// 구조:
//   Agent → list_postiz_integrations() → 연결된 채널 id 확인
//   Agent → send_to_postiz(variant_id, integration_id, scheduled_at?)
//       → Postiz API POST /posts (variant.body_text + hashtags 로 DTO 구성)
//       → 성공 시: variant.status = 'sent_to_postiz' 업데이트
//                 variant.platform_settings.postiz_post_id 기록
//                 create_publication(channel, postiz_post_id) 자동 호출
//
// 전제:
//   - POSTIZ_API_URL 환경변수 (예: https://postiz.agenticworkflows.club)
//   - POSTIZ_API_KEY 환경변수 (Postiz 워크스페이스 설정에서 발급)
//
// Postiz API 호출 형식은 배포 버전마다 다를 수 있어 raw_payload override 를 지원.
// 기본 DTO 가 안 맞으면 에이전트가 raw_payload 로 직접 body 전달.
export function registerPostizTools(server: McpServer, adapter: CMSAdapter): void {
  const postizUrl = (process.env.POSTIZ_API_URL ?? '').replace(/\/+$/, '');
  const postizKey = process.env.POSTIZ_API_KEY ?? '';

  const postizConfigured = Boolean(postizUrl && postizKey);

  const postizFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    if (!postizConfigured) {
      throw new Error(
        'Postiz not configured. Set POSTIZ_API_URL and POSTIZ_API_KEY env vars before using Postiz tools.',
      );
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: postizKey,
      // 일부 Postiz 버전은 x-api-key 를 기대함 — 둘 다 보내 호환성 확보.
      'x-api-key': postizKey,
      ...(init?.headers as Record<string, string> | undefined),
    };
    return fetch(`${postizUrl}${path}`, { ...init, headers });
  };

  server.tool(
    'list_postiz_integrations',
    '[Pipeline step 6 — Publish] List connected social integrations in Postiz (returns id + platform + display name per channel). Use this first to get the integration_id before calling send_to_postiz.',
    {},
    async () => {
      try {
        const res = await postizFetch('/public/v1/integrations');
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(`Postiz /integrations failed (${res.status}): ${JSON.stringify(body)}`);
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ integrations: body }, null, 2) }],
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
    'send_to_postiz',
    [
      '[Pipeline step 6 — Publish] Send a variant to Postiz for immediate or scheduled publication to the connected social channel.',
      'Typical flow: create_variant (step 4) → update_variant to fill body_text & hashtags → list_postiz_integrations → send_to_postiz.',
      'On success: variant.status becomes "sent_to_postiz", postiz_post_id is stored in platform_settings, and a publications row is automatically created.',
      'Use raw_payload to bypass the default DTO builder when a specific Postiz feature (media, thread, poll, etc.) is needed.',
    ].join(' '),
    {
      variant_id: z.string().uuid().describe('Variant id to publish. variant.body_text will be used as the post content.'),
      integration_id: z
        .string()
        .describe('Postiz integration id (channel). Get from list_postiz_integrations.'),
      channel: z
        .string()
        .optional()
        .describe(
          'Channel label for the publication record (e.g. "linkedin", "instagram"). If omitted, tries to infer from variant.platform.',
        ),
      scheduled_at: z
        .string()
        .optional()
        .describe('ISO 8601 timestamp to schedule the post. Omit for immediate publish.'),
      raw_payload: z
        .record(z.unknown())
        .optional()
        .describe(
          'Advanced: fully override the Postiz POST /posts body. If set, the tool sends this payload as-is (still records variant link + publication on 2xx).',
        ),
      dry_run: z
        .boolean()
        .optional()
        .describe('If true, builds the payload but does NOT call Postiz — useful for agent debugging.'),
    },
    async (params) => {
      try {
        const sb = getSupabase();

        // 1. variant 조회
        const { data: variant, error: varErr } = await sb
          .from('variants')
          .select('id, content_id, platform, format, body_text, hashtags, platform_settings, status')
          .eq('id', params.variant_id)
          .single();
        if (varErr || !variant) throw new Error(`Variant not found: ${params.variant_id}`);

        // 2. Postiz payload 구성 (raw_payload 없으면 기본 DTO)
        //    기본 DTO 는 Postiz public API 공통 형식 — 배포 버전 차이 있을 수 있으니
        //    안 맞으면 raw_payload 로 바이패스.
        const hashtagLine = (variant.hashtags as string[] | null)?.length
          ? '\n\n' + (variant.hashtags as string[]).join(' ')
          : '';
        const content = `${variant.body_text ?? ''}${hashtagLine}`.trim();
        const defaultPayload = {
          type: params.scheduled_at ? 'schedule' : 'now',
          date: params.scheduled_at ?? new Date().toISOString(),
          posts: [
            {
              integration: { id: params.integration_id },
              value: [{ content, media: [] }],
              settings: variant.platform_settings ?? {},
            },
          ],
        };
        const payload = params.raw_payload ?? defaultPayload;

        if (params.dry_run) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  { message: 'dry_run — payload built but not sent', payload },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // 3. Postiz 호출
        const res = await postizFetch('/public/v1/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const respBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(
            `Postiz /posts failed (${res.status}): ${JSON.stringify(respBody)}. Payload shape mismatch? Try raw_payload.`,
          );
        }

        // Postiz 응답에서 post id 추출 (필드명은 버전마다 조금씩 다름 — 보수적으로 탐색)
        const postizPostId =
          (respBody.id as string | undefined) ??
          (Array.isArray(respBody.posts) ? (respBody.posts[0] as { id?: string } | undefined)?.id : undefined) ??
          null;

        // 4. variant status / platform_settings 업데이트
        const newSettings = {
          ...((variant.platform_settings as Record<string, unknown> | null) ?? {}),
          postiz_post_id: postizPostId,
          postiz_integration_id: params.integration_id,
          postiz_sent_at: new Date().toISOString(),
        };
        await sb
          .from('variants')
          .update({ status: 'sent_to_postiz', platform_settings: newSettings })
          .eq('id', params.variant_id);

        // 5. publication 기록 (실제 발행 시각은 Postiz 가 스케줄 처리 후 webhook 으로
        //    알려주는 것이 이상적이지만, 현재는 '예약/즉시 발행 요청 시점' 을 기록).
        const channel = params.channel ?? variant.platform ?? 'postiz';
        try {
          await adapter.createPublication({
            content_id: variant.content_id as string,
            variant_id: variant.id as string,
            channel,
            postiz_post_id: postizPostId ?? undefined,
          });
        } catch (err) {
          // publication 기록 실패가 Postiz 발행을 되돌리지는 않는다 — 경고만.
          console.error('[send_to_postiz] publication record failed:', err);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: params.scheduled_at
                    ? `Scheduled via Postiz at ${params.scheduled_at}.`
                    : 'Sent to Postiz for immediate publish.',
                  variant_id: variant.id,
                  postiz_post_id: postizPostId,
                  channel,
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
