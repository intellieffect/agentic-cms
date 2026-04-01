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

## 현재 MCP 도구 (13개)
list_contents, get_content, create_content, update_content, list_ideas, promote_idea, create_publication, get_metrics, get_activity_logs, get_revisions, revert_to_revision, list_media, create_media

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
