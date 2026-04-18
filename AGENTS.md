# Agentic CMS — AGENTS.md

## 프로젝트 개요
오픈소스 Agentic CMS. MCP 서버로 AI 에이전트가 CMS를 조작하는 구조.
핵심 철학: "에이전트가 만들고, 사람이 터치하고, 에이전트가 기억한다."

## 구조
- `src/` — MCP 서버 (TypeScript ESM)
- `dashboard/` — Next.js 15 + Tailwind 4 + shadcn/ui 대시보드
- `supabase/` — DB 마이그레이션
- `reference/` — Payload·Strapi·Directus·shadcn-admin 클론 (.gitignore)

## 기술 스택
- MCP 서버: TypeScript, ESM, Supabase adapter
- 대시보드: Next.js 15, Tailwind CSS 4 (`@plugin` 방식), shadcn/ui (공식 sidebar 사용)
- DB: Supabase (PostgreSQL), project_ref=euhxmmiqfyptvsvvbbvp
- npm 패키지명: @brxce/agentic-cms

## 콘텐츠 파이프라인 (v2)
```
Topics (고정 테마 3~5개) → Ideas (구체적 앵글) → Contents (마스터 콘텐츠) → Variants (플랫폼별 변환) → Postiz (발행)
```

### 각 단계
1. **Topics**: 고정 카테고리. "에이전틱 워크플로우", "AI 마케팅" 등. 월 1회 수정.
2. **Ideas**: Topic 안의 구체적 앵글. 에이전트가 자동 수집 + 사람이 직접 입력. 매일 운영.
3. **Contents**: 마스터 콘텐츠. hook + body_md + CTA. 에이전트가 작성, 사람이 편집(human touch).
4. **Variants**: 1 content → N variants. 플랫폼(instagram/linkedin/threads) × 포맷(reel/carousel/post/article/thread).
5. **Publish**: Agentic CMS에서 직접 발행 안 함. Postiz API로 전송만.

### 피드백 루프
- 사람의 편집 → `revisions.delta` + `actor_type: human` 기록
- 에이전트가 `get_revisions`로 조회 → 다음 생성 시 패턴 반영
- 발행 후 metrics → 에이전트 분석 → 다음 variant에 반영

## 현재 DB 테이블
- ideas (id, raw_text, source, promoted_to, created_at)
- contents (id, title, slug, status, category, body_md, tags, hook, core_message, media_type, media_urls, funnel_stage, cta, fact_checked, created_at, updated_at, scheduled_publish_at)
- publications (id, content_id, channel, channel_post_id, url, published_at, metrics)
- activity_logs (id, action, collection, item_id, actor, actor_type, payload, timestamp)
- revisions (id, content_id, version_number, data, delta, created_by, actor_type, created_at)
- media (id, filename, mime_type, file_size, width, height, url, storage_path, alt_text, caption, created_by, created_at)
- content_media (id, content_id, media_id, role, sort_order)
- content_relations (id, source_id, target_id, relation_type, sort_order)

## 현재 MCP 도구 (파이프라인 단계별)

에이전트 사용법: 도구 description 첫 부분에 `[Pipeline step N — Stage]` 태그가 있음. 그 흐름대로 호출.

- **Step 1 — Strategy**: `list_topics`, `create_topic`
- **Step 2 — Discover**: `list_ideas`, `get_idea`, `create_idea`, `update_idea`, `promote_idea`
- **Step 3 — Create (master)**: `list_contents`, `get_content`, `create_content`, `update_content`
- **Step 4 — Adapt**: `list_variants`, `create_variant`, `update_variant`
- **Step 5 — Production (derivatives)**:
  - Blog: `list_blog_categories`, `list_blog_posts`, `get_blog_post`, `create_blog_post_from_markdown(..., variant_id)`, `update_blog_post`
  - Carousel: `list_carousels`, `get_carousel`, `create_carousel(..., variant_id)`, `update_carousel`
  - Video: `list_video_projects`, `get_video_project`, `create_video_project`, `link_video_project_to_variant`, `extract_beats`, `render_video`, `get_render_status`, `list_videos`, `probe_media`
  - Media: `list_media`, `create_media`
- **Step 6 — Publish**: `send_newsletter`, `create_publication(..., variant_id)`
- **Feedback loop**: `get_metrics`, `get_activity_logs`, `get_revisions`, `get_human_feedback`, `revert_to_revision`

## 에이전트 e2e 워크플로우 예시

**시나리오**: "3명이 운영하는 하드웨어 스타트업 사례" 를 블로그 + LinkedIn thread + 뉴스레터로 배포.

```
1. list_topics()                                    → "AX 전환" topic 선택
2. create_idea({
     raw_text: "3명 운영, AI 팀원 4명 들인 후...",
     topic_id: <AX 전환 id>,
     angle: "case study",
     target_audience: "지방 하드웨어 중소기업 대표"
   })                                               → idea.id
3. promote_idea({idea_id, title, slug, hook, cta})  → content (draft)
4. update_content({id, body_md, core_message})      → 본문 채움
5. create_variant({content_id, platform:'blog', format:'blog'})         → variant_blog
6. create_variant({content_id, platform:'linkedin', format:'thread'})   → variant_thread
7. create_blog_post_from_markdown({
     title, slug, markdown_body, category_slug:'case-study',
     variant_id: variant_blog.id
   })                                               → blog_post (연결 완료)
8. send_newsletter({post_id, variant_id: variant_blog.id})
                                                    → 구독자 발송 + email_logs.variant_id 세팅
9. update_variant({id: variant_thread.id, body_text, hashtags})
                                                    → LinkedIn 본문 채움
10. create_publication({
      content_id, variant_id: variant_thread.id,
      channel: 'linkedin', url: 'https://...'
    })                                              → Publish tracking
11. get_metrics({content_id})                       → 다음 차수 계획
```

결과 트리:
```
Content (master)
├─ Variant[blog] ─→ blog_post
│                   └─ email_logs (newsletter 발송 이력)
├─ Variant[thread] ─→ Publication(linkedin)
└─ (추후) Variant[carousel] ─→ Carousel
```

## 파이프라인 사용 규칙

- **에이전트 주도, 사람은 편집**: 모든 생성/연결은 에이전트가 MCP 로. 대시보드는 사람이 draft 검토/수정하고 Publish 를 승인하는 창.
- **1:1 UNIQUE**: blog_posts / carousels / video_projects 의 variant_id 는 1:1. 한 variant 는 하나의 파생 레코드에만 연결 가능.
- **status=published 는 인간 승인**: 에이전트는 published 로 전환 못함 (update_content 에서 차단). Studio/대시보드에서 사람이 최종 승인.
- **actor_type**: 에이전트 작업은 activity_logs 에 actor_type='agent' 로 기록, 사람 편집은 'human'. 피드백 루프에서 구분 활용.

## 코딩 규칙
- 공식 컴포넌트/라이브러리가 있으면 반드시 사용. 자체 구현 금지.
- Tailwind 4: `@plugin` 방식, `@theme` 블록 사용
- shadcn/ui: 공식 sidebar (726줄 버전) 사용 중. SidebarInset 패턴.
- 서버 액션: `"use server"` + revalidatePath
- 타입: 모든 인터페이스는 src/types.ts (MCP), dashboard/src/lib/types.ts (대시보드)
- 안전장치: create_content → 항상 draft, update_content → published 전환 차단 (MCP 레벨)

## Supabase 연결
- URL: 환경변수 SUPABASE_URL (또는 NEXT_PUBLIC_SUPABASE_URL)
- Key: 환경변수 SUPABASE_SERVICE_ROLE_KEY
- .env.local (dashboard)에 설정됨

## Claude Code 에서 MCP 사용법

Claude Code 는 `.mcp.json` (repo 루트) 또는 사용자 설정으로 MCP 서버를 등록한다.

### 프로젝트 루트 `.mcp.json` 예시

`<...>` 부분은 **본인 환경에 맞게** 교체.

```json
{
  "mcpServers": {
    "agentic-cms": {
      "command": "node",
      "args": ["<repo 절대 경로>/agentic-cms/dist/server.js"],
      "env": {
        "SUPABASE_URL": "https://<project-ref>.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service-role-key>",
        "DASHBOARD_API_URL": "http://localhost:3003",
        "DASHBOARD_MCP_SECRET": "<optional: newsletter send auth — dashboard env 와 동일 값>",
        "POSTIZ_API_URL": "https://postiz.agenticworkflows.club",
        "POSTIZ_API_KEY": "<Postiz Settings → API 에서 발급>",
        "POSTIZ_AUTH_SCHEME": "raw",
        "CONTENT_CORE_CLI_PATH": "<awc repo 절대 경로>/awc/packages/content-core/dist/cli.js"
      }
    }
  }
}
```

**env 설명**
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: **필수**. Supabase 프로젝트 접속.
- `DASHBOARD_API_URL`: 뉴스레터 발송 시 dashboard `/api/newsletter/send` 호출에 사용. 기본 `http://localhost:3003`.
- `DASHBOARD_MCP_SECRET`: 옵션. dashboard 쪽에도 동일 값 설정돼 있으면 외부 호출 검증용 secret.
- `POSTIZ_API_URL` / `POSTIZ_API_KEY`: Postiz 소셜 발행에 **필수**. Postiz 사용 안 할 거면 생략 — send_to_postiz 도구만 기능 꺼짐.
- `POSTIZ_AUTH_SCHEME`: `raw` (기본) / `bearer` / `x-api-key` 중 택 1. Postiz 배포 버전에 따라 다름. 400/401 나면 바꿔 시도.
- `CONTENT_CORE_CLI_PATH`: AWC 의 `@awc/content-core` CLI 경로. create_blog_post_from_markdown 에서만 필요.

### 사전 빌드
`npm install && npm run build` 로 `dist/server.js` 가 생성돼야 `node dist/server.js` 로 실행 가능. Claude Code 재시작하면 MCP 서버에 연결.

### 연결 검증
Claude Code 에서 새 세션 시작 후: "agentic-cms 의 MCP 도구 목록 알려줘" → `list_topics` / `create_idea` / ... 등 도구 이름이 보이면 성공.

## Postiz 연동

소셜 채널 실제 발행은 Postiz 를 통한다.

### 사전 설정 (Postiz 쪽)
1. https://postiz.agenticworkflows.club 또는 자가 호스팅 Postiz 인스턴스
2. Settings → API → API Key 생성
3. 각 소셜 채널(Instagram/LinkedIn/Threads/X/YouTube) 을 Integrations 에서 OAuth 연결

### 에이전트 사용 흐름
```
1. list_postiz_integrations()             → 연결된 채널 id 확인
2. send_to_postiz({
     variant_id,                          → 발행할 variant
     integration_id,                      → 위에서 확보한 id
     scheduled_at?                        → 즉시 발행이면 생략
   })
→ variant.status = 'sent_to_postiz'
→ variant.platform_settings.postiz_post_id 기록
→ publications 테이블에 자동 기록 (content_id + variant_id + channel)
```

### 발행 실패 시
- DTO 형식 불일치가 Postiz 버전에 따라 발생 가능. 기본 DTO 가 안 맞으면 `raw_payload` 파라미터로 에이전트가 직접 body 구성 후 전달.
- `dry_run: true` 로 실 호출 없이 payload 만 미리 확인 가능.

## 에이전트 e2e 파이프라인 (Postiz 포함)

**시나리오**: "AX 전환 토픽으로 블로그 + LinkedIn + 뉴스레터 + Instagram 발행"

```
1. list_topics()                                    → AX 전환 id
2. create_idea({topic_id, raw_text, angle})         → idea.id
3. promote_idea({idea_id, title, slug, hook, cta})  → content (draft)
4. update_content({id, body_md, core_message})      → 본문
5. create_variant(blog) → variant_blog
6. create_blog_post_from_markdown(variant_id=blog.id) → blog_post
7. send_newsletter(post_id, variant_id=blog.id)     → 뉴스레터 발송
8. create_variant(linkedin thread) → variant_linkedin
9. create_variant(instagram carousel) → variant_ig
10. create_carousel(variant_id=ig.id, slides)       → carousel 레코드
11. list_postiz_integrations()                      → linkedin_id, ig_id
12. send_to_postiz(variant_id=linkedin.id, integration_id=linkedin_id) → LinkedIn 발행
13. send_to_postiz(variant_id=ig.id, integration_id=ig_id)              → Instagram 발행
```

→ Contents 상세에 blog/carousel/newsletter/publications 전부 variant 트리로 연결 표시.
