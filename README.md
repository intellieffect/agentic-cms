# Agentic CMS

> Open-source MCP server that turns any CMS backend into an AI-agent-ready content management system.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is this?

Agentic CMS is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI agents full access to your content management workflows — create, read, update, publish, and track content through a standardized protocol.

Instead of building AI features *into* your CMS, Agentic CMS wraps *around* it. Your CMS stays as-is. The agents get a clean interface to work with.

```
┌─────────────────┐     MCP Protocol     ┌──────────────┐
│  AI Agents       │ ◄──────────────────► │  Agentic CMS │
│                  │     stdio / SSE      │  MCP Server   │
│  · Claude        │                      │               │
│  · OpenClaw      │                      │  Adapters:    │
│  · Cursor        │                      │  · Supabase   │
│  · Any MCP client│                      │  · Payload    │
└─────────────────┘                      │  · Strapi     │
                                          │  · (yours)    │
                                          └───────┬───────┘
                                                  │
                                          ┌───────▼───────┐
                                          │  Your CMS DB  │
                                          └───────────────┘
```

## Why?

- **Your CMS, your data** — Self-hosted, no vendor lock-in
- **Adapter pattern** — Supabase today, Payload/Strapi/anything tomorrow
- **MCP standard** — Works with Claude Desktop, OpenClaw, Cursor, and any MCP-compatible client
- **Safety first** — Publishing requires human approval by default. Agents create drafts, humans publish.
- **Open source** — MIT licensed. Use it, fork it, extend it.

## Features

### Tools (MCP)

| Tool | Description |
|------|-------------|
| `list_contents` | List content with filters (status, category, tags) |
| `get_content` | Get a single content item by slug or ID |
| `create_content` | Create new content (always starts as `draft`) |
| `update_content` | Update content fields (title, body, tags, etc.) |
| `list_ideas` | List content ideas |
| `promote_idea` | Promote an idea to a draft content item |
| `create_publication` | Record a publication event (channel, URL, metrics) |
| `get_metrics` | Get performance metrics for content |

### Safety

- `create_content` always sets status to `draft` — agents cannot publish directly
- `update_content` blocks status changes to `published` — human approval required
- All operations are logged and auditable

## Quick Start

### 1. Install

```bash
npm install @brxce/agentic-cms
```

### 2. Configure

Create `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run

```bash
npx agentic-cms
```

### 4. Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentic-cms": {
      "command": "npx",
      "args": ["@brxce/agentic-cms"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key"
      }
    }
  }
}
```

### 5. Connect to OpenClaw

```yaml
# ~/.openclaw/config.yaml
mcp:
  servers:
    agentic-cms:
      command: npx
      args: ["@brxce/agentic-cms"]
      env:
        SUPABASE_URL: https://your-project.supabase.co
        SUPABASE_SERVICE_ROLE_KEY: your-key
```

## Adapters

Agentic CMS uses an adapter pattern to support different CMS backends.

### Available

- **Supabase** — For Supabase/PostgreSQL-based CMS setups

### Planned

- **Payload CMS** — TypeScript-native headless CMS
- **Strapi** — Popular open-source headless CMS
- **Directus** — SQL-based headless CMS
- **Custom** — Implement the `CMSAdapter` interface for any backend

### Writing Your Own Adapter

```typescript
import { CMSAdapter } from '@brxce/agentic-cms';

export class MyAdapter implements CMSAdapter {
  async listContents(filter?: ContentFilter): Promise<Content[]> {
    // Your implementation
  }
  async getContent(idOrSlug: string): Promise<Content> {
    // Your implementation
  }
  // ... other methods
}
```

## Architecture

```
src/
├── server.ts              # MCP server entry point
├── tools/                 # MCP tool definitions
│   ├── contents.ts        # Content CRUD tools
│   ├── ideas.ts           # Idea management tools
│   └── publications.ts    # Publication tracking tools
├── adapters/
│   ├── interface.ts       # CMSAdapter interface
│   ├── supabase.ts        # Supabase adapter
│   └── (future adapters)
└── types.ts               # Shared types
```

## Supabase Schema

If you're starting fresh, here's the minimum schema:

```sql
-- Contents
create table contents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  status text default 'draft' check (status in ('draft', 'review', 'published')),
  category text,
  body_md text,
  tags text[],
  hook text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ideas
create table ideas (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  source text default 'manual',
  promoted_to uuid references contents(id),
  created_at timestamptz default now()
);

-- Publications
create table publications (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references contents(id),
  channel text not null,
  url text,
  published_at timestamptz default now(),
  metrics jsonb default '{}'
);
```

## Multi-tenant deployment

agentic-cms 는 **env 기반 multi-tenant** 구조입니다. 같은 코드베이스로 여러 고객을 각자의 Supabase · Storage · 브랜딩으로 서비스할 수 있습니다.

### 시스템 prerequisites (모든 tenant 공통)

```bash
# macOS
brew install ffmpeg yt-dlp node pnpm python@3.12

# Ubuntu/Debian
sudo apt install ffmpeg python3.12 python3.12-venv
pip install yt-dlp
npm install -g pnpm
# Node.js 22+: https://nodejs.org/
```

### 새 고객 onboarding 체크리스트

1. **Supabase 프로젝트 생성** (고객 전용)
   - Free/Pro plan, project_ref 기록
   - `supabase/migrations/*.sql` 전부 적용 (Studio SQL Editor, 파일명 오름차순 순서대로)
   - 자동 적용 항목:
     - 14+ 테이블 생성 (contents/ideas/variants/blog_posts/carousels/video_projects 등)
     - 5 storage bucket 생성 (content-media, studio-renders, references, finished, blog-images) — migration `20260419000000` 이 자동 처리
     - RLS policies 공개 읽기 + service_role 관리
2. **`.env` 파일 3개 작성** (각 프로젝트 루트의 `.env.example` 기준)
   - `./.env` — MCP 서버용
   - `./dashboard/.env.local` — Next.js dashboard
   - `./editor/.env` — Python 영상 편집 서버
3. **Multi-tenant 핵심 env (반드시 고객별로 교체)**
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (혹은 `SUPABASE_SERVICE_KEY`)
   - `NEXT_PUBLIC_SITE_URL` — 고객 웹사이트 URL
   - `NEXT_PUBLIC_BRAND_NAME` — 뉴스레터 헤더 · meta title suffix 에 노출
   - `NEXT_PUBLIC_BRAND_HANDLE` / `NEXT_PUBLIC_BRAND_EMOJI` / `NEXT_PUBLIC_BRAND_AVATAR_URL` — 캐러셀 워터마크/아바타
   - `NEXT_PUBLIC_CONTACT_EMAIL` / `NEXT_PUBLIC_CONTACT_DOMAIN` — 캐러셀 CTA 슬라이드
   - `ANALYTICS_OWN_DOMAINS` — self-referrer whitelist (쉼표 구분)
   - `ANALYTICS_VERCEL_KEYWORDS` — vercel preview 도메인 자사 식별
   - `NEWSLETTER_FROM` — 뉴스레터 발신인 `"Display Name <addr@domain>"`
   - `META_TITLE_SUFFIX` — blog post meta_title 꼬리
   - `TABLE_PROJECTS=video_projects` (editor/.env, 필수)
   - `STORAGE_MODE=cloud` (editor/.env, 권장)
4. **외부 API Key** (선택 기능)
   - `RESEND_API_KEY` — 뉴스레터 발송
   - `GOOGLE_SERVICE_ACCOUNT_KEY` — GA4/GSC analytics
   - `POSTIZ_API_URL` + `POSTIZ_API_KEY` — 소셜 채널 발행
5. **로컬 개발 기동**
   ```bash
   # MCP 서버용 의존성
   npm install && npm run build

   # dashboard 의존성
   cd dashboard && npm install && cd ..

   # editor Python 가상환경
   cd editor && python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt && cd ..

   # editor Remotion 의존성
   cd editor/remotion && pnpm install && cd ../..

   # Next.js dashboard + Python editor 동시 기동
   cd dashboard && npm run dev:all
   ```
6. **Claude Code 에서 MCP 서버 연결**
   - `.mcp.json` 을 repo 루트에 생성 (`AGENTS.md` 예시 참고)
   - Claude Code 재시작 → 43+ MCP 도구 자동 노출

### 고객 분리 원칙

- **DB 분리** — 고객마다 별도 Supabase 프로젝트 (데이터 완전 격리)
- **코드 공유** — 동일 git branch, env 주입만 다름
- **브랜딩 격리** — 위 env 교체만으로 로고·이메일·도메인 전부 고객 것으로 전환
- **배포 분리** — 고객마다 별도 Vercel/Cloud Run 배포 권장 (env 분리 확실)

### 코드에 하드코딩된 브랜딩 없음 원칙

신규 기능 추가 시 "AWC", "agenticworkflows.club", "특정 이메일" 등 구체 값을 직접 박지 말고 env 로 주입. 테넌트별 차이가 생길 여지는 전부 env 통로를 둔다.

---

## Philosophy

> "Nobody cares about your tech. They care that their problem got solved."

Agentic CMS isn't about adding AI to your CMS. It's about making your content workflow AI-native — so agents handle the repetitive work and humans focus on judgment and creativity.

Built by [IntelliEffect](https://intellieffect.com) as part of the [Agentic Workflow Club](https://agenticworkflows.club).

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

## License

[MIT](LICENSE)
