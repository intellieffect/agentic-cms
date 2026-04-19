# brxce-editor Integration Guide

다른 Next.js 프로젝트에 brxce-editor를 이식하기 위한 가이드입니다.

> **2026-04-18 부: 이 문서는 historical reference 입니다.** brxce-editor 는 agentic-cms 의 `editor/` 서브디렉토리로 이식되었고, 더 이상 독립 소스 복제 워크플로우를 권장하지 않습니다.
> 아래 Step 들은 **과거에 썼던 방식** 을 기록한 것으로, 새 프로젝트에 이식할 경우 참고용으로만 읽으세요.
> 현재 agentic-cms 에서 editor 사용법은 `../AGENTS.md` 의 "로컬 개발 실행" 섹션 참고.

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [프로젝트 구조 개요](#2-프로젝트-구조-개요)
3. [Step 1: 파일 복사](#3-step-1-파일-복사)
4. [Step 2: 의존성 설치](#4-step-2-의존성-설치)
5. [Step 3: Config 설정](#5-step-3-config-설정)
6. [Step 4: Next.js 설정](#6-step-4-nextjs-설정)
7. [Step 5: 페이지 라우트 등록](#7-step-5-페이지-라우트-등록)
8. [Step 6: Supabase DB 설정](#8-step-6-supabase-db-설정)
9. [Step 7: Python 백엔드 설정](#9-step-7-python-백엔드-설정)
10. [Step 8: 미디어 파일 설정](#10-step-8-미디어-파일-설정)
11. [Step 9: 사이드바 메뉴 연결](#11-step-9-사이드바-메뉴-연결)
12. [Step 10: 검증](#12-step-10-검증)
13. [Config 레퍼런스](#13-config-레퍼런스)
14. [테마 커스텀](#14-테마-커스텀)
15. [SideNav 메뉴 커스텀](#15-sidenav-메뉴-커스텀)
16. [편집기 모드 선택](#16-편집기-모드-선택)
17. [Python 테이블명 커스텀](#17-python-테이블명-커스텀)
18. [Cloud 배포 (Docker / Cloud Run)](#18-cloud-배포-docker--cloud-run)
19. [트러블슈팅](#19-트러블슈팅)

---

## 1. 사전 요구사항

| 항목 | 버전 |
|---|---|
| Node.js | 20+ |
| Python | 3.10+ |
| pnpm | 9+ |
| Next.js (호스트 앱) | 15+ |
| Supabase 프로젝트 | 필요 |

---

## 2. 프로젝트 구조 개요

```
brxce-editor/
├── editor.config.ts        # ⭐ 설정 파일
├── index.ts                # 패키지 exports
├── lib/
│   ├── editor-routes.ts    # 라우트 헬퍼
│   └── with-brxce-editor.ts # Next.js config 플러그인
├── app/                    # 페이지 (복사 대상)
├── components/             # UI 컴포넌트 (복사 대상)
├── data/                   # 정적 데이터
├── sdk/                    # API 클라이언트
├── src/
│   ├── server/             # Python FastAPI 백엔드
│   ├── editor/             # 영상 편집기 (HTML/JS)
│   └── db/                 # DB 클라이언트
├── requirements.txt        # Python 의존성
└── supabase/migrations/    # DB 스키마
```

---

## 3. Step 1: 파일 복사

호스트 앱에 brxce-editor 파일을 복사합니다. `{prefix}`는 호스트 앱에서 brxce-editor를 넣을 경로입니다 (예: `be/`).

### 3-1. 프론트엔드 파일

```bash
HOST_APP=~/Projects/your-app
BE_SRC=~/Projects/agentic-cms/editor   # 2026-04-18 이식 이후 위치
PREFIX=be  # 호스트 앱 내 경로 prefix

# 페이지 복사 (app/ → src/app/{prefix}/)
mkdir -p $HOST_APP/src/app/$PREFIX
for dir in carousel content dashboard editor finished references studio; do
  cp -r $BE_SRC/app/$dir $HOST_APP/src/app/$PREFIX/
done

# 컴포넌트 복사
cp -r $BE_SRC/components $HOST_APP/src/components/$PREFIX

# Lib 복사
mkdir -p $HOST_APP/src/lib/$PREFIX
cp $BE_SRC/lib/types.ts $HOST_APP/src/lib/$PREFIX/
cp $BE_SRC/lib/utils.ts $HOST_APP/src/lib/$PREFIX/
cp $BE_SRC/lib/video-format.ts $HOST_APP/src/lib/$PREFIX/
cp -r $BE_SRC/lib/studio $HOST_APP/src/lib/$PREFIX/

# Config 복사
cp $BE_SRC/editor.config.ts $HOST_APP/src/lib/$PREFIX/
cp $BE_SRC/lib/editor-routes.ts $HOST_APP/src/lib/$PREFIX/
cp $BE_SRC/lib/with-brxce-editor.ts $HOST_APP/src/lib/$PREFIX/

# Data & SDK 복사
cp -r $BE_SRC/data $HOST_APP/
cp -r $BE_SRC/sdk $HOST_APP/
```

### 3-2. 백엔드 파일

```bash
# Python 서버
cp -r $BE_SRC/src/server $HOST_APP/src/server
cp -r $BE_SRC/src/db $HOST_APP/src/db
cp $BE_SRC/requirements.txt $HOST_APP/

# 영상 편집기 (HTML/JS만, 미디어 파일 제외)
mkdir -p $HOST_APP/src/editor/js
cp $BE_SRC/src/editor/*.html $HOST_APP/src/editor/
cp $BE_SRC/src/editor/js/*.js $HOST_APP/src/editor/js/
cp $BE_SRC/src/editor/_resolver_config.json $HOST_APP/src/editor/
```

### 3-3. Import 경로 수정

복사한 파일에서 import 경로를 일괄 변경합니다:

```bash
# 컴포넌트 import 경로 변경
find $HOST_APP/src/app/$PREFIX -name "*.tsx" -exec \
  sed -i '' "s|@/components/|@/components/$PREFIX/|g" {} +

# lib import 경로 변경
find $HOST_APP/src/app/$PREFIX -name "*.tsx" -exec \
  sed -i '' "s|@/lib/|@/lib/$PREFIX/|g" {} +

# 컴포넌트 내부의 상호 참조도 수정
find $HOST_APP/src/components/$PREFIX -name "*.tsx" -name "*.ts" -exec \
  sed -i '' "s|@/components/|@/components/$PREFIX/|g; s|@/lib/|@/lib/$PREFIX/|g; s|@/editor.config|@/lib/$PREFIX/editor.config|g" {} +
```

---

## 4. Step 2: 의존성 설치

### 프론트엔드

```bash
cd $HOST_APP
pnpm add @remotion/player@4.0.440 @remotion/transitions@4.0.440 remotion@4.0.440 zustand html-to-image jszip
```

### 백엔드

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

---

## 5. Step 3: Config 설정

`src/lib/{prefix}/editor.config.ts`를 호스트 앱에 맞게 수정합니다:

```typescript
import { setEditorConfig } from './editor.config';

setEditorConfig({
  // 라우트 prefix (호스트 앱 내 brxce-editor 경로)
  routePrefix: '/be',

  // Python 백엔드 URL (호스트 앱과 다른 포트 사용)
  apiUrl: 'http://localhost:8093',

  // 편집기 모드: 'iframe' | 'remotion' | 'both' (기본: 'both')
  editorMode: 'both',

  // Supabase 테이블명 (호스트 앱 DB에 맞게)
  tables: {
    videos: 'ref_posts',           // 기본: 'reference_videos'
    accounts: 'ref_accounts',      // 기본: 'reference_accounts'
    // 나머지는 기본값 사용
  },

  // 미디어 경로
  media: {
    root: '/Volumes/Media',
    finished: '~/Desktop/_미디어/완료영상',
    defaultSource: '/Volumes/Seagate/인텔리이펙트 영상소스',
  },

  // SideNav 메뉴 커스텀 (선택)
  // navItems: [...],  // 미지정 시 기본 메뉴 사용
});
```

---

## 6. Step 4: Next.js 설정

`next.config.ts`에 `withBrxceEditor` 플러그인을 적용합니다:

```typescript
import type { NextConfig } from 'next';
import { withBrxceEditor } from './src/lib/be/with-brxce-editor';

const nextConfig: NextConfig = {
  // 기존 설정 유지
};

export default withBrxceEditor(nextConfig, {
  apiPort: 8093,        // Python 백엔드 포트
  routePrefix: '/be',   // 라우트 prefix
});
```

이 플러그인이 자동으로 추가하는 것:
- `/api/projects`, `/api/carousels` 등 → Flask 백엔드 프록시
- `/index.html`, `/js/*` 등 → 편집기 HTML/JS 프록시
- `*.mp4`, `*.mov` 등 → 미디어 파일 프록시

---

## 7. Step 5: 페이지 라우트 등록

### 레이아웃 파일 생성

`src/app/{prefix}/layout.tsx` 생성:

```typescript
// 호스트 앱의 레이아웃을 사용하는 경우 (빈 layout)
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// brxce-editor 자체 레이아웃을 사용하는 경우
// import LayoutShell from '@/components/{prefix}/LayoutShell';
// export default function EditorLayout({ children }: { children: React.ReactNode }) {
//   return <LayoutShell>{children}</LayoutShell>;
// }
```

### 호스트 앱의 인증 바이패스

호스트 앱에 인증이 있다면, `/{prefix}/*` 경로를 바이패스합니다:

```typescript
// 예: AdminShell.tsx
const BYPASS_PATHS = ['/be'];
const isBypass = BYPASS_PATHS.some((p) => pathname.startsWith(p));

// 인증 체크에서 제외
if (!isAdmin && !isBypass) { /* 권한 없음 */ }
```

---

## 8. Step 6: Supabase DB 설정

### 8-1. 테이블 생성

`supabase/migrations/` 폴더의 SQL을 순서대로 실행합니다:

```bash
# 1. 기본 스키마
psql $DATABASE_URL < supabase/migrations/001_init.sql

# 2. favorite 컬럼
psql $DATABASE_URL < supabase/migrations/20260323_add_favorite.sql

# 3. 캐러셀 테이블
psql $DATABASE_URL < supabase/migrations/20260327_create_carousels.sql

# 4. 통합 레퍼런스 (선택)
psql $DATABASE_URL < supabase/migrations/20260327_unified_references.sql
```

또는 Supabase Dashboard SQL Editor에서 직접 실행합니다.

### 8-2. 생성되는 테이블 목록

| 테이블 | 용도 |
|---|---|
| `projects` | 영상 프로젝트 |
| `presets` | 편집 프리셋 |
| `render_jobs` | 렌더링 작업 |
| `finished_videos` | 완료 영상 |
| `reference_accounts` | 레퍼런스 계정 |
| `reference_videos` | 레퍼런스 영상 |
| `carousels` | 캐러셀 프로젝트 |
| `ref_accounts` | 통합 레퍼런스 계정 |
| `ref_posts` | 통합 레퍼런스 게시물 |
| `ref_slides` | 슬라이드 |

### 8-3. .env 파일 생성

```bash
# 호스트 앱 루트에 .env 생성

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# 서버
PORT=8093

# 미디어 경로
MEDIA_ROOT=/Volumes/Media
FINISHED_DIR=~/Desktop/_미디어/완료영상
DEFAULT_SOURCE_DIR=/Volumes/Seagate/인텔리이펙트 영상소스
LEGACY_MEDIA_DIRS=/Volumes/Media

# API 키
GEMINI_API_KEY=your-gemini-key

# 테이블명 커스텀 (선택 — 기본값과 다른 경우만 설정)
# TABLE_VIDEOS=reference_videos
# TABLE_ACCOUNTS=reference_accounts
# TABLE_CAROUSELS=carousels
# TABLE_PROJECTS=projects
# TABLE_FINISHED=finished_videos
# TABLE_PRESETS=presets
# TABLE_RENDER_JOBS=render_jobs
# TABLE_REF_POSTS=ref_posts
# TABLE_REF_ACCOUNTS=ref_accounts
# TABLE_REF_SLIDES=ref_slides
# TABLE_STORYBOARDS=storyboards
# TABLE_SUBTITLES=subtitles
# TABLE_COLLECTIONS=reference_collections
# TABLE_COLLECTION_ITEMS=reference_collection_items
# TABLE_PLANS=plans
```

---

## 9. Step 7: Python 백엔드 설정

### 9-1. venv 생성 및 의존성 설치

```bash
cd $HOST_APP
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 9-2. 실행

```bash
# 개발 모드 (hot reload)
.venv/bin/python -m uvicorn src.server.app:app --port 8093 --reload

# package.json에 스크립트 추가 (권장)
# "dev:api": ".venv/bin/python -m uvicorn src.server.app:app --port 8093 --reload"
```

### 9-3. 테이블명 커스텀 (선택)

Python 백엔드의 테이블명은 **환경변수**로 관리됩니다. `.env` 파일에서 설정하면 코드 수정 없이 변경 가능합니다:

```bash
# .env
TABLE_VIDEOS=ref_posts          # 기본: reference_videos
TABLE_ACCOUNTS=ref_accounts     # 기본: reference_accounts
```

모든 테이블명 환경변수는 `src/server/table_config.py`에서 관리됩니다.

> ℹ️ 프론트엔드(`editor.config.ts`)와 Python 백엔드(`.env`)의 테이블명을 **양쪽 모두 동일하게** 맞춰야 합니다.

---

## 10. Step 8: 미디어 파일 설정

영상 편집기는 로컬 영상 파일에 접근해야 합니다.

### 10-1. 편집기 리졸버 설정

`src/editor/_resolver_config.json`을 호스트 환경에 맞게 수정:

```json
{
  "sourceDirectories": [
    "/Volumes/Media",
    "~/Desktop/_영상소스"
  ],
  "pathMappings": {}
}
```

### 10-2. 프록시 비디오 (심볼릭 링크)

편집기가 참조하는 프록시 비디오 폴더를 연결합니다:

```bash
# 기존 brxce-editor의 프록시 폴더를 심볼릭 링크
ln -s /path/to/original/proxy-videos $HOST_APP/src/editor/_proxy
ln -s /path/to/original/projects $HOST_APP/src/editor/_projects
```

---

## 11. Step 9: 사이드바 메뉴 연결

호스트 앱의 사이드바에 brxce-editor 링크를 추가합니다:

```typescript
// 예시: AppSidebar.tsx
// 세 묶음 구조: 영상 / 캐러셀 / 콘텐츠 기획
{
  title: "콘텐츠 제작",  // 섹션 타이틀
  items: [
    {
      href: "/be/editor",
      label: "영상",
      icon: Video,
      children: [
        { href: "/be/editor", label: "영상 프로젝트" },
        { href: "/be/references", label: "영상 레퍼런스" },
        { href: "/be/finished", label: "완료 영상" },
      ],
    },
    {
      href: "/be/carousel",
      label: "캐러셀",
      icon: Smartphone,
      children: [
        { href: "/be/carousel", label: "캐러셀 목록" },
        { href: "/be/carousel/templates", label: "템플릿" },
        { href: "/be/carousel/references", label: "레퍼런스" },
      ],
    },
    { href: "/be/content", label: "콘텐츠 기획", icon: FileText },
  ],
}
```

### 페이지 URL 목록

| 경로 | 기능 |
|---|---|
| `/{prefix}/dashboard` | 에디터 대시보드 |
| `/{prefix}/editor` | 영상 프로젝트 목록 → 클릭 시 편집기 |
| `/{prefix}/studio?project={id}` | Remotion 영상 편집기 |
| `/{prefix}/references` | 영상 레퍼런스 |
| `/{prefix}/finished` | 완료 영상 |
| `/{prefix}/carousel` | 캐러셀 목록 |
| `/{prefix}/carousel/{id}` | 캐러셀 편집기 |
| `/{prefix}/carousel/templates` | 캐러셀 템플릿 |
| `/{prefix}/carousel/references` | 캐러셀 레퍼런스 |
| `/{prefix}/content` | 콘텐츠 기획 허브 |
| `/{prefix}/content/plans` | 기획안 목록 |
| `/{prefix}/content/storyboard` | 스토리보드 |
| `/{prefix}/content/subtitles` | 자막 관리 |

---

## 12. Step 10: 검증

### 12-1. 서버 구동

```bash
# 터미널 1: Python 백엔드
cd $HOST_APP && .venv/bin/python -m uvicorn src.server.app:app --port 8093 --reload

# 터미널 2: Next.js
cd $HOST_APP && pnpm dev
```

### 12-2. 체크리스트

```
[ ] 호스트 앱 기존 페이지 정상 작동
[ ] /{prefix}/dashboard 접근 가능
[ ] /{prefix}/editor 프로젝트 목록 표시
[ ] 프로젝트 클릭 → /{prefix}/studio?project=ID → Remotion 편집기 작동
[ ] /{prefix}/carousel 캐러셀 목록 표시
[ ] 캐러셀 클릭 → 편집기 작동
[ ] /{prefix}/references 레퍼런스 데이터 표시
[ ] /{prefix}/finished 완료 영상 표시 + 재생
[ ] /{prefix}/carousel/templates 템플릿 목록 표시
[ ] API 프록시 정상 (/api/projects → Flask)
```

### 12-3. API 테스트

```bash
PORT=8093  # Python 백엔드 포트
for endpoint in /api/projects /api/carousels /api/finished /api/references/accounts; do
  echo "$endpoint: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT$endpoint)"
done
```

---

## 13. Config 레퍼런스

### EditorConfig

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `routePrefix` | string | `''` | 페이지 경로 prefix (예: `/be`) |
| `apiUrl` | string | `'http://localhost:8092'` | Python 백엔드 URL |
| `tables.videos` | string | `'reference_videos'` | 영상 레퍼런스 테이블 |
| `tables.accounts` | string | `'reference_accounts'` | 계정 테이블 |
| `tables.carousels` | string | `'carousels'` | 캐러셀 테이블 |
| `tables.projects` | string | `'projects'` | 프로젝트 테이블 |
| `tables.finished` | string | `'finished_videos'` | 완료 영상 테이블 |
| `tables.presets` | string | `'presets'` | 프리셋 테이블 |
| `tables.renderJobs` | string | `'render_jobs'` | 렌더 작업 테이블 |
| `tables.refPosts` | string | `'ref_posts'` | 통합 레퍼런스 게시물 |
| `tables.refAccounts` | string | `'ref_accounts'` | 통합 레퍼런스 계정 |
| `tables.refSlides` | string | `'ref_slides'` | 슬라이드 |
| `media.root` | string | `'/Volumes/Media'` | 미디어 루트 경로 |
| `media.finished` | string | `'~/Desktop/_미디어/완료영상'` | 완료 영상 경로 |
| `media.defaultSource` | string | (긴 경로) | 기본 소스 디렉토리 |
| `supabase.url` | string? | - | Supabase URL |
| `supabase.serviceKey` | string? | - | Supabase Service Role Key |
| `navItems` | NavItem[]? | (기본 메뉴) | SideNav 커스텀 메뉴 |
| `editorMode` | string? | `'both'` | `'iframe'` \| `'remotion'` \| `'both'` |
| `mediaProxyPrefix` | string? | `"/_proxy"` | 미디어 파일 URL prefix |

### withBrxceEditor Options

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `apiPort` | number | `8092` | Flask 백엔드 포트 |
| `routePrefix` | string | `''` | 라우트 prefix |

---

## 14. 트러블슈팅

### 이중 사이드바

호스트 앱 레이아웃이 brxce-editor 위에 겹쳐 보이는 경우:
- `/{prefix}/layout.tsx`에서 빈 layout 사용 (`<>{children}</>`)
- 호스트 앱의 쉘 컴포넌트에서 `/{prefix}` 경로를 바이패스

### 포트 충돌

brxce-editor 원본(8092)과 호스트 앱 Flask가 충돌하는 경우:
- `.env`의 `PORT`를 다른 값으로 변경 (예: 8093)
- `editor.config.ts`의 `apiUrl`과 `withBrxceEditor`의 `apiPort`를 동일하게 맞추기

### CSS 충돌

brxce-editor 스타일이 호스트 앱에 영향을 주는 경우:
- brxce-editor CSS는 `.brxce-editor` selector로 scoping됨
- `LayoutShell.tsx`의 root div에 `className="brxce-editor"` 확인

### 테이블 not found

DB 테이블이 없다는 에러:
- `supabase/migrations/` SQL 실행 확인
- `editor.config.ts`의 `tables` 설정과 실제 DB 테이블명 일치 확인
- Python 백엔드의 테이블명도 별도 수정 필요 (프론트엔드 config와 연동 안 됨)

### 영상 파일 404

편집기에서 영상이 로드되지 않는 경우:
- `src/editor/_resolver_config.json`의 `sourceDirectories` 경로 확인
- `_proxy/` 심볼릭 링크 확인
- Flask 서버가 실행 중인지 확인

---

## 14. 테마 커스텀

brxce-editor는 CSS 변수 기반 테마를 지원합니다. 호스트 앱에서 변수를 오버라이드하면 전체 색상을 변경할 수 있습니다.

### CSS 변수 목록

```css
.brxce-editor {
  --be-bg: #0f0f0f;              /* 배경 */
  --be-bg-card: #141414;         /* 카드 배경 */
  --be-bg-input: #1a1a1a;        /* 입력 필드 배경 */
  --be-bg-hover: #222;           /* 호버 배경 */
  --be-bg-btn: #222;             /* 버튼 배경 */
  --be-bg-accent: #4a9eff;       /* 강조 배경 */
  --be-bg-danger: #e04040;       /* 위험 배경 */
  --be-border: #333;             /* 테두리 */
  --be-border-light: #222;       /* 연한 테두리 */
  --be-border-hover: #444;       /* 호버 테두리 */
  --be-text: #e0e0e0;            /* 텍스트 */
  --be-text-muted: #888;         /* 흐린 텍스트 */
  --be-text-dim: #666;           /* 더 흐린 텍스트 */
  --be-text-accent: #4a9eff;     /* 강조 텍스트 */
  --be-accent: #4a9eff;          /* 강조 색상 */
  --be-accent-hover: #3a8eef;    /* 강조 호버 */
  --be-danger: #e04040;          /* 위험 색상 */
  --be-danger-hover: #c03030;    /* 위험 호버 */
  --be-sidenav-width: 220px;     /* 사이드네비 너비 */
}
```

### 호스트 앱에서 오버라이드

```css
/* 호스트 앱의 globals.css */
.brxce-editor {
  --be-accent: #FF6B35;          /* 오렌지 테마로 변경 */
  --be-accent-hover: #e55a2b;
  --be-bg: #1a1a2e;              /* 다크 네이비 배경 */
  --be-bg-card: #16213e;
}
```

### TypeScript 테마 헬퍼

인라인 스타일에서 CSS 변수를 사용하려면 `lib/theme.ts`를 import:

```typescript
import { theme } from 'brxce-editor/lib/theme';

<div style={{ background: theme.bgCard, color: theme.text }}>
```

---

## 15. SideNav 메뉴 커스텀

기본 메뉴를 유지하거나 완전히 커스텀할 수 있습니다.

### 기본 메뉴 사용 (변경 없음)

```typescript
setEditorConfig({
  routePrefix: '/be',
  // navItems 미지정 → 기본 메뉴 사용
});
```

### 기본 메뉴 확장

```typescript
import { buildDefaultNavItems } from 'brxce-editor/components/SideNav';
import { setEditorConfig } from 'brxce-editor';

const defaultItems = buildDefaultNavItems();
setEditorConfig({
  routePrefix: '/be',
  navItems: [
    ...defaultItems,
    { href: '/be/custom-page', icon: '⚡', label: '커스텀 페이지' },
  ],
});
```

### 완전 커스텀 메뉴

```typescript
setEditorConfig({
  routePrefix: '/be',
  navItems: [
    { href: '/be/editor', icon: '🎬', label: '영상' },
    { href: '/be/carousel', icon: '🎠', label: '캐러셀' },
    // 필요한 항목만 포함
  ],
});
```

### NavItem 타입

```typescript
interface NavItem {
  href: string;
  icon: string;
  label: string;
  children?: NavItem[];
}
```

---

## 16. 편집기 모드 선택

brxce-editor는 두 가지 영상 편집기를 제공합니다:

| 모드 | 경로 | 기술 | 용도 |
|---|---|---|---|
| **iframe** | `/{prefix}/editor` | HTML/JS (Flask 서빙) | 클립 자르기, 타임라인, BGM, 자막 |
| **remotion** | `/{prefix}/studio?project=ID` | Remotion (React) | 프리뷰, 패널 기반 편집, 렌더링 |

### 모드 설정

```typescript
setEditorConfig({
  editorMode: 'both',      // 기본값: 양쪽 모두 사용
  // editorMode: 'iframe',  // iframe 편집기만
  // editorMode: 'remotion', // Remotion 편집기만
});
```

### 추천 워크플로우

1. **프로젝트 목록** (`/editor`) → 프로젝트 선택
2. **Remotion 편집기** (`/studio?project=ID`) → 편집 + 프리뷰
3. **iframe 편집기** (`/editor?project=ID`) → 세밀한 타임라인 편집

---

## 17. Python 테이블명 커스텀

모든 테이블명은 `src/server/table_config.py`에서 환경변수로 관리됩니다.

### table_config.py 구조

```python
import os

TABLE_VIDEOS = os.environ.get('TABLE_VIDEOS', 'reference_videos')
TABLE_ACCOUNTS = os.environ.get('TABLE_ACCOUNTS', 'reference_accounts')
TABLE_CAROUSELS = os.environ.get('TABLE_CAROUSELS', 'carousels')
TABLE_PROJECTS = os.environ.get('TABLE_PROJECTS', 'projects')
TABLE_FINISHED = os.environ.get('TABLE_FINISHED', 'finished_videos')
TABLE_PRESETS = os.environ.get('TABLE_PRESETS', 'presets')
TABLE_RENDER_JOBS = os.environ.get('TABLE_RENDER_JOBS', 'render_jobs')
TABLE_REF_POSTS = os.environ.get('TABLE_REF_POSTS', 'ref_posts')
TABLE_REF_ACCOUNTS = os.environ.get('TABLE_REF_ACCOUNTS', 'ref_accounts')
TABLE_REF_SLIDES = os.environ.get('TABLE_REF_SLIDES', 'ref_slides')
TABLE_STORYBOARDS = os.environ.get('TABLE_STORYBOARDS', 'storyboards')
TABLE_SUBTITLES = os.environ.get('TABLE_SUBTITLES', 'subtitles')
TABLE_COLLECTIONS = os.environ.get('TABLE_COLLECTIONS', 'reference_collections')
TABLE_COLLECTION_ITEMS = os.environ.get('TABLE_COLLECTION_ITEMS', 'reference_collection_items')
TABLE_PLANS = os.environ.get('TABLE_PLANS', 'plans')
```

### 호스트 앱에서 설정

`.env` 파일에 변경할 테이블명만 추가:

```bash
# 통합 레퍼런스 스키마를 사용하는 경우
TABLE_VIDEOS=ref_posts
TABLE_ACCOUNTS=ref_accounts
```

> ⚠️ 프론트엔드 `editor.config.ts`의 `tables` 설정과 Python `.env`의 테이블명을 **동일하게** 맞춰야 합니다.

---

## 18. Cloud 배포 (Docker / Cloud Run)

brxce-editor는 `STORAGE_MODE` 환경변수를 통해 로컬/클라우드 스토리지를 전환합니다.

### 환경변수

| 변수 | 값 | 설명 |
|---|---|---|
| `STORAGE_MODE` | `local` (기본값) | 로컬 파일시스템 사용 — 기존 동작과 동일 |
| `STORAGE_MODE` | `cloud` | Supabase Storage 사용 |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Supabase service role key |

### Docker 빌드 & 실행

```bash
# 빌드
docker build -t brxce-editor .

# 로컬 모드 실행 (기본값)
docker run -p 8092:8092 --env-file .env brxce-editor

# 클라우드 모드 실행
docker run -p 8092:8092 \
  -e STORAGE_MODE=cloud \
  -e SUPABASE_URL=https://xxx.supabase.co \
  -e SUPABASE_SERVICE_KEY=eyJ... \
  brxce-editor
```

### Google Cloud Run 배포

```bash
# 1. Container Registry에 푸시
gcloud builds submit --tag gcr.io/PROJECT_ID/brxce-editor

# 2. Cloud Run 배포
gcloud run deploy brxce-editor \
  --image gcr.io/PROJECT_ID/brxce-editor \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars "STORAGE_MODE=cloud,SUPABASE_URL=https://xxx.supabase.co,SUPABASE_SERVICE_KEY=eyJ..." \
  --memory 2Gi \
  --timeout 600
```

### Supabase Storage 버킷 설정

Cloud 모드 사용 시 아래 Storage 버킷이 필요합니다:

| 버킷 | 용도 | Public |
|---|---|---|
| `media` | 원본 미디어 파일 | Yes |
| `finished` | 완료 영상 + 썸네일 | Yes |
| `references` | 레퍼런스 영상 + 썸네일 | Yes |

### DB 마이그레이션 (Cloud 모드)

```sql
-- file_paths 테이블 (파일 경로 매핑)
-- supabase/migrations/20260404_resolver_paths.sql 참조
```

---

## 19. 트러블슈팅

### 이중 사이드바

호스트 앱 레이아웃이 brxce-editor 위에 겹쳐 보이는 경우:
- `/{prefix}/layout.tsx`에서 빈 layout 사용 (`<>{children}</>`)
- 호스트 앱의 쉘 컴포넌트에서 `/{prefix}` 경로를 바이패스

### 포트 충돌

brxce-editor 원본(8092)과 호스트 앱 Flask가 충돌하는 경우:
- `.env`의 `PORT`를 다른 값으로 변경 (예: 8093)
- `editor.config.ts`의 `apiUrl`과 `withBrxceEditor`의 `apiPort`를 동일하게 맞추기

### CSS 충돌

brxce-editor 스타일이 호스트 앱에 영향을 주는 경우:
- brxce-editor CSS는 `.brxce-editor` selector로 scoping됨
- `LayoutShell.tsx`의 root div에 `className="brxce-editor"` 확인
- 호스트 앱에서 `.brxce-editor` 내부 CSS 변수를 오버라이드하여 테마 조정

### 테이블 not found

DB 테이블이 없다는 에러:
- `supabase/migrations/` SQL 실행 확인
- `.env`의 `TABLE_*` 환경변수와 실제 DB 테이블명 일치 확인
- `editor.config.ts`의 `tables` 설정도 동일하게 맞추기

### 영상 파일 404

편집기에서 영상이 로드되지 않는 경우:
- `src/editor/_resolver_config.json`의 `sourceDirectories` 경로 확인
- `_proxy/` 심볼릭 링크 확인
- Flask 서버가 실행 중인지 확인

### top-bar CSS 누락

이식 후 상단 바 버튼이 여러 줄로 표시되는 경우:
- `.top-bar`에 `flex-wrap: nowrap; overflow-x: auto;` 확인
- `.top-bar-right`에 `flex-shrink: 0; flex-wrap: nowrap;` 확인
- `.top-bar .btn`에 `white-space: nowrap; flex-shrink: 0;` 확인
- 이 스타일들은 `.brxce-editor` 하위에 scoping되어 있으므로, be/layout.tsx에 `className="brxce-editor"` wrapper가 반드시 필요합니다.
