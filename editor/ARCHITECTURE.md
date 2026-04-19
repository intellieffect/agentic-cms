# brxce-editor Architecture

> **2026-04-18 부: historical reference 문서.** 이 문서는 brxce-editor 를 brxce.ai 모노레포에서 독립 프로젝트로 분리하던 시점의 설계를 기록함. 이후 agentic-cms 의 `editor/` 로 한 번 더 이식되었으므로, 현재 아키텍처 정답지는 `../AGENTS.md` + `../CHANGELOG.md` 참고.
> 아래 path 들 (`~/Desktop/_개발/brxce.ai/...`) 은 **당시 경로** 라 현재는 유효하지 않음. 구조 파악용으로만 읽기.

## 목표 (당시)
brxce.ai 모노레포에서 영상 편집 기능을 독립 프로젝트로 분리.
brxce.ai는 그대로 유지하면서, brxce-editor를 모듈(SDK/iframe/API)로 가져다 쓰는 구조.

## 원본 파일 위치 (brxce.ai — 당시)
모든 원본은 아래에 있었음. **복사해서 재구성**하는 것이지 원본을 삭제하는 게 아니었음.

### 에디터 코어 (프론트)
- `~/Desktop/_개발/brxce.ai/apps/studio/public/video-editor/index.html` — 메인 에디터 UI (737줄)
- `~/Desktop/_개발/brxce.ai/apps/studio/public/video-editor/editor.html` — 리다이렉터 (18줄)
- `~/Desktop/_개발/brxce.ai/apps/studio/public/video-editor/js/` — JS 모듈들:
  - `state.js` — 상태 관리
  - `init.js` — 초기화
  - `panels.js` — 패널 UI
  - `playback.js` — 재생 로직
  - `subtitles.js` — 자막 UI
  - `projects.js` — 프로젝트 관리
  - `interaction.js` — 인터랙션
  - `crop-zoom.js` — 크롭/줌
  - `kenburns.js` — 켄번스 효과
  - `reference.js` — 레퍼런스 연동

### Python 서버 (백엔드)
- `server.py` (2345줄) — 미디어 서빙 + 렌더링 + 썸네일 + API
- `subtitle_renderer.py` (229줄) — 자막 렌더러
- `studio_cli.py` (1718줄) — CLI 도구

### Next.js API Routes (brxce.ai 측, DB 연동)
- `apps/studio/src/app/api/video-projects/route.ts` — 프로젝트 CRUD
- `apps/studio/src/app/api/video-projects/[id]/route.ts` — 프로젝트 단건
- `apps/studio/src/app/api/references/video/` — 레퍼런스 관련 API 6개
- `apps/studio/src/lib/studio/video-project-store.ts` — Supabase CRUD
- `apps/studio/src/lib/studio/video-project-constants.ts` — 상수
- `apps/studio/src/lib/studio/video-templates.ts` — 프리셋

### Next.js 페이지 (brxce.ai 측)
- `apps/studio/src/app/studio/video-edit/page.tsx` — 에디터 iframe 래퍼
- `apps/studio/src/app/studio/templates/video-tab.tsx` — 프리셋 탭
- `apps/studio/src/app/studio/references/video/page.tsx` — 레퍼런스 페이지
- `apps/studio/src/components/studio/VideoSceneEditor.tsx` — 씬 에디터

### 기타 자산
- `_fonts/` — 한글 폰트 15개
- `_projects/` — 로컬 JSON 프로젝트 파일들 (레거시, DB 이관 진행 중)
- `_resolver_config.json` — 경로 리졸버 설정

### 현재 Supabase (brxce.ai 공유 DB)
- DB: `euhxmmiqfyptvsvvbbvp.supabase.co`
- 테이블: `video_projects` (마이그레이션: `20260320000000_video_projects.sql`)
- `reference_accounts`, `reference_videos` 도 같은 DB에 있음

## 새 프로젝트 구조 (brxce-editor)

```
brxce-editor/
├── src/
│   ├── editor/              ← 프론트 (HTML/JS)
│   │   ├── index.html
│   │   ├── editor.html
│   │   └── js/              ← JS 모듈 그대로
│   ├── server/              ← FastAPI 통합 서버
│   │   ├── app.py           ← 메인 (API + 미디어 서빙 + 에디터 서빙)
│   │   ├── routes/
│   │   │   ├── projects.py  ← 프로젝트 CRUD (기존 Next.js API → FastAPI)
│   │   │   ├── references.py← 레퍼런스 API
│   │   │   ├── render.py    ← 렌더링 API
│   │   │   ├── media.py     ← 미디어/썸네일 서빙
│   │   │   └── presets.py   ← 프리셋 API
│   │   ├── renderer.py      ← 렌더링 엔진 (기존 server.py에서 분리)
│   │   └── subtitles.py     ← 자막 렌더러
│   ├── cli/
│   │   └── studio_cli.py    ← CLI (서버 URL만 변경)
│   ├── db/
│   │   └── supabase.py      ← Supabase 클라이언트
│   └── presets/             ← 프리셋 JSON들
├── assets/
│   └── fonts/               ← 폰트 파일들
├── sdk/                     ← JS SDK (npm 패키지)
│   ├── embed.ts
│   ├── api-client.ts
│   └── types.ts
├── supabase/
│   └── migrations/
│       └── 001_init.sql     ← 새 DB 스키마
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── package.json
└── README.md
```

## 서버 통합 계획
현재 Next.js(3200)의 API Routes + Python(8090)의 서버를 FastAPI 단일 서버(8090)로 통합.

### 통합 매핑
| 현재 | 새 FastAPI |
|------|-----------|
| Next.js `GET/POST /api/video-projects` | `GET/POST /api/projects` |
| Next.js `GET/PATCH/DELETE /api/video-projects/:id` | `GET/PATCH/DELETE /api/projects/:id` |
| Next.js `/api/references/video/*` | `/api/references/*` |
| Python `GET /api/render/status` | `GET /api/render/status` |
| Python `POST /api/render` | `POST /api/render` |
| Python `GET /api/thumbnail/:file` | `GET /api/media/thumbnail/:file` |
| Python 정적 파일 서빙 | `GET /static/*` + `GET /editor.html` |

### 핵심 원칙
1. 에디터 프론트(index.html + JS)는 FastAPI에서 정적 서빙
2. 프로젝트 CRUD는 FastAPI에서 직접 Supabase 호출 (Next.js 프록시 불필요)
3. 렌더링/미디어는 기존 Python 로직 재사용
4. brxce.ai의 video-edit/page.tsx는 iframe src만 변경하면 됨

## 새 Supabase DB 스키마

```sql
-- projects (기존 video_projects 확장)
create table projects (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  orientation varchar(20) default 'vertical',
  status text default 'draft' check (status in ('draft','published','archived')),
  project_data jsonb not null,
  thumbnail_url text,
  duration float,
  clip_count int default 0,
  source_files jsonb,
  workspace_id text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- presets
create table presets (
  id text primary key,
  name varchar(100) not null,
  description text,
  category varchar(50),
  config jsonb not null,
  is_system boolean default true,
  created_at timestamptz default now()
);

-- reference_accounts
create table reference_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text,
  platform text default 'instagram',
  avatar_url text,
  created_at timestamptz default now()
);

-- reference_videos
create table reference_videos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references reference_accounts(id),
  platform text,
  post_date timestamptz,
  duration_sec float,
  like_count int default 0,
  comment_count int default 0,
  view_count int,
  caption text,
  url text,
  thumbnail_url text,
  video_url text,
  style_tags text[],
  transition_tags text[],
  music_tags text[],
  notes text,
  created_at timestamptz default now()
);

-- render_jobs
create table render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  status text default 'queued' check (status in ('queued','rendering','done','failed')),
  output_url text,
  progress float default 0,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);
```
