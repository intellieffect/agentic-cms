import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CMSAdapter } from '../adapters/interface.js';

// 뉴스레터 발송 MCP 도구.
//
// 구조:
//   Agent → send_newsletter(post_id, variant_id?)
//       → Dashboard /api/newsletter/send (blog_post → HTML 렌더 + subscribers 조회 +
//                                         Resend 발송 + email_logs/newsletter_deliveries 기록)
//       → MCP 가 response 의 emailLogId 로 email_logs.variant_id 업데이트
//
// 왜 Dashboard 에 위임하나:
//   발송 로직(PlateJS→HTML, 썸네일/이미지 처리, Resend rate-limit, 배달 추적) 이 이미 336 lines
//   로 dashboard 쪽에 구현돼 있음. MCP 에서 중복 구현할 이유가 없고 두 곳에서 버전 불일치가
//   생기면 운영 사고 위험. HTTP wrapper + 링크 후처리만 책임진다.
//
// 전제:
//   - DASHBOARD_API_URL 환경변수 (기본 http://localhost:3003) 에 dashboard 가 떠있어야 한다.
//   - dashboard 는 service-role Supabase 키로 동작하므로 별도 auth 필요 없음 (같은 신뢰 경계).
export function registerNewsletterTools(
  server: McpServer,
  adapter: CMSAdapter,
  supabaseUrl: string,
  supabaseKey: string,
): void {
  const sb: SupabaseClient = createClient(supabaseUrl, supabaseKey);
  const dashboardUrl = (process.env.DASHBOARD_API_URL ?? 'http://localhost:3003').replace(/\/+$/, '');

  server.tool(
    'send_newsletter',
    [
      'Send a blog post as a newsletter to subscribers via the dashboard send pipeline.',
      'Optionally records which variant (format=blog) this send was derived from, so the',
      'Content detail page shows the send count on the Variants & Derivatives card.',
      'Prerequisites: the dashboard app must be running (DASHBOARD_API_URL env var, default http://localhost:3003).',
    ].join(' '),
    {
      post_id: z
        .string()
        .uuid()
        .describe('blog_post.id to render and send (required).'),
      variant_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          'Optional variant(id) (format=blog) to link on email_logs. ' +
            'If omitted, the tool auto-resolves via blog_posts.variant_id.',
        ),
      preview: z
        .boolean()
        .optional()
        .describe('If true, send only to admin preview recipient(s) (dashboard controls which).'),
      force: z
        .boolean()
        .optional()
        .describe('If true, ignore the "already sent" duplicate check.'),
    },
    async (params) => {
      try {
        // 1. Resolve variant_id if not provided
        let variantId = params.variant_id ?? null;
        if (!variantId) {
          const { data: post } = await sb
            .from('blog_posts')
            .select('variant_id')
            .eq('id', params.post_id)
            .maybeSingle();
          variantId = (post as { variant_id: string | null } | null)?.variant_id ?? null;
        }

        // 2. Call dashboard send endpoint
        const res = await fetch(`${dashboardUrl}/api/newsletter/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: params.post_id,
            preview: params.preview ?? false,
            force: params.force ?? false,
          }),
        });

        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          emailLogId?: string;
          sentCount?: number;
          failedCount?: number;
          finalStatus?: string;
          error?: string;
        };

        if (!res.ok || body.error) {
          throw new Error(
            `Dashboard send failed (${res.status}): ${body.error ?? 'unknown'}. ` +
              `Is dashboard running at ${dashboardUrl}?`,
          );
        }

        // 3. Link email_logs.variant_id after successful send.
        //    preview 모드는 관리자 테스트 발송이므로 실제 독자 발송 이력으로 기록되면
        //    Content 상세의 "📧 N명 발송" 배지에 가짜 이력이 섞인다. variant 링크 스킵.
        let linkedVariantId: string | null = null;
        if (!params.preview && variantId && body.emailLogId) {
          const { error: linkErr } = await sb
            .from('email_logs')
            .update({ variant_id: variantId })
            .eq('id', body.emailLogId);
          if (!linkErr) linkedVariantId = variantId;
          else {
            // 링크 실패해도 발송 자체는 완료. 경고만 로그.
            console.error(`[send_newsletter] email_logs.variant_id 링크 실패:`, linkErr.message);
          }
        }

        // 4. Record as Publication (channel='newsletter') for pipeline visibility
        try {
          await adapter.logActivity({
            action: 'publish',
            collection: 'email_logs',
            item_id: body.emailLogId ?? 'unknown',
            actor_type: 'agent',
            payload: {
              post_id: params.post_id,
              variant_id: linkedVariantId,
              sent_count: body.sentCount ?? 0,
              failed_count: body.failedCount ?? 0,
              final_status: body.finalStatus ?? 'unknown',
            },
          });
        } catch {
          // 감사 로그 실패는 발송을 막지 않는다.
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: `Newsletter sent. ${body.sentCount ?? 0} success, ${body.failedCount ?? 0} failed.`,
                  email_log_id: body.emailLogId ?? null,
                  variant_id_linked: linkedVariantId,
                  final_status: body.finalStatus ?? 'unknown',
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
