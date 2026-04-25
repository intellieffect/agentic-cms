# brxce-editor (agentic-cms 에 이식됨)

> # ⚠️ DEPRECATED for editing — see [DEPRECATED.md](./DEPRECATED.md)
>
> **dashboard의 영상 편집기를 수정하려면 `editor/`가 아닌 `dashboard/src/components/{studio,remotion}/`을 수정하세요.**
>
> 이 디렉토리의 `components/`, `app/`, `lib/` 는 dashboard로 fully ported된 후 historical reference로 보존 중입니다.
> 단, `editor/remotion/src/` (server-side Remotion render bundle) 와 `editor/src/server/` (Python API) 는 여전히 운영에서 사용됩니다.

AI 기반 숏폼 영상 편집기. 레퍼런스 분석 → 소스 자동 매칭 → 비트 싱크 → BGM 매칭 → 프로젝트 생성까지 자동화.

> **이식 안내 (2026-04-18)**: 이 프로젝트는 원래 독립 repo (`https://github.com/intelli-ddd/brxce-editor`) 였으나, `agentic-cms` 의 `editor/` 서브디렉토리로 흡수됨. 독립 실행도 가능하지만, 기본 사용 방식은 agentic-cms dashboard 의 영상 관련 기능이 이 서버에 proxy 로 위임하는 구조.
> 자세한 통합 내역: `../CHANGELOG.md` · sync 가이드: [`./DEPRECATED.md`](./DEPRECATED.md)

## Quick Start

### 1. 시스템 의존성

```bash
# macOS
brew install ffmpeg yt-dlp node

# Ubuntu/Debian
sudo apt install ffmpeg
pip install yt-dlp
# Node.js: https://nodejs.org/
```

### 2. 설치

```bash
# agentic-cms 를 clone 받은 뒤 editor 서브디렉토리로 이동
git clone https://github.com/intellieffect/agentic-cms.git
cd agentic-cms/editor

# Python 환경
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Node.js 환경
npm install
```

### 3. 환경변수

```bash
cp .env.example .env
# .env 파일을 열고 Supabase URL/Key 설정
```

**Supabase 설정:**
1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/001_init.sql` 실행
3. SQL Editor에서 `supabase/migrations/20260323_add_favorite.sql` 실행
4. Storage에 `references` 버킷 생성 (public)
5. `.env`에 URL과 Service Key 입력

### 4. 실행

```bash
# 방법 1: 두 서버 동시 실행
make dev

# 방법 2: 수동 실행
# 터미널 1 — FastAPI 백엔드 (포트 8092)
source .venv/bin/activate
python -m uvicorn src.server.app:app --host 0.0.0.0 --port 8092

# 터미널 2 — Next.js 프론트엔드 (포트 3100)
npm run dev
```

### 5. 접속

- **에디터 UI**: http://localhost:8092/editor.html (바닐라 JS 에디터)
- **프로젝트 관리**: http://localhost:3100 (Next.js 대시보드)
- **API 문서**: http://localhost:8092/docs (FastAPI Swagger)

---

## 사용 가이드

### 영상 편집 (기본 플로우)

1. **에디터 열기**: `http://localhost:8092/editor.html` 접속
2. **영상 추가**: 왼쪽 패널의 드롭존에 영상 파일을 **드래그 앤 드롭** (또는 클릭하여 선택)
   - 지원 형식: MP4, MOV, AVI, MKV, WebM
   - 이미지(JPG, PNG, HEIC)도 가능 — 자동으로 정지 영상 클립으로 변환됨
   - 업로드된 파일은 `src/editor/`에 저장됨
3. **타임라인 편집**: 소스 목록에서 영상을 타임라인으로 드래그
   - 클립 트림: 클립 양 끝을 드래그
   - 클립 분할: 블레이드 도구(B키) → 클릭
   - 속도 변경: 클립 선택 → 오른쪽 패널에서 조절
   - 크롭/줌: 클립 선택 → 크롭/줌 탭
4. **BGM 추가**: 하단 BGM 트랙에 음원 파일 드래그 앤 드롭 (MP3, WAV, M4A 등)
   - 🪄 자동 구간 찾기: BGM 선택 → "자동 구간 찾기" 클릭 → AI가 최적 구간 추천
5. **자막 추가**: 자막 탭에서 텍스트 입력 + 시간 설정
6. **트랜지션**: 클립 사이 트랜지션 아이콘 클릭 → fade, wipe, slide 등 선택
7. **렌더링**: 오른쪽 상단 "렌더" 버튼 → MP4 파일 다운로드

### 프로젝트 관리 (Next.js 대시보드)

1. `http://localhost:3100` 접속
2. 프로젝트 생성/목록 확인
3. "🎬 영상으로 프로젝트 생성" — 영상 파일을 업로드하면 자동으로 클립 구성
4. 프로젝트 클릭 → 에디터로 이동

### 자동 프로젝트 생성 (AI, Supabase 필요)

레퍼런스 영상의 컷 구조를 분석하여 소스 영상으로 자동 프로젝트 생성:

```bash
curl -X POST http://localhost:8092/api/auto-project/create \
  -H "Content-Type: application/json" \
  -d '{
    "referenceId": "레퍼런스-영상-ID",
    "sourceDir": "/path/to/source/videos",
    "bgmSource": "음원파일.mp3",
    "beatSync": true
  }'
```

### Supabase 없이 사용하기

Supabase를 설정하지 않아도 핵심 편집 기능은 모두 동작합니다:
- ✅ 영상 업로드/편집/타임라인
- ✅ BGM 추가 + AI 자동 구간 찾기
- ✅ 자막, 트랜지션, 이펙트
- ✅ 렌더링 (MP4 출력)
- ✅ 프로젝트 저장/로드 (로컬 JSON)
- ❌ 레퍼런스 관리/자동 발굴
- ❌ 자동 프로젝트 생성
- ❌ Next.js 대시보드 통계

---

### Docker

```bash
docker compose up
# http://localhost:8092/editor.html
```

---

## 아키텍처

```
brxce-editor/
├── app/                    # Next.js 프론트엔드 (프로젝트 목록, 레퍼런스 관리)
│   ├── page.tsx            # 대시보드
│   ├── editor/             # 에디터 페이지 (src/editor 로드)
│   ├── references/         # 레퍼런스 관리 UI
│   └── finished/           # 완료 영상 목록
│
├── src/
│   ├── editor/             # 바닐라 JS 에디터 (타임라인, 재생, 자막 등)
│   │   ├── index.html      # 메인 에디터 UI
│   │   ├── js/             # 모듈별 JS (bgm, playback, subtitles, kenburns 등)
│   │   └── _projects/      # 로컬 프로젝트 JSON (gitignored)
│   │
│   ├── server/             # FastAPI 백엔드
│   │   ├── app.py          # 엔트리포인트 + 라우터 등록 + 정적 파일 서빙
│   │   ├── renderer.py     # ffmpeg 렌더링 엔진 (6단계 파이프라인)
│   │   ├── subtitles.py    # 자막 렌더링 (Pillow)
│   │   └── routes/
│   │       ├── projects.py      # 프로젝트 CRUD (DB + 로컬 JSON)
│   │       ├── render.py        # 렌더링 시작/상태/다운로드
│   │       ├── media.py         # 미디어 업로드/프로브/리졸버
│   │       ├── references.py    # 레퍼런스 영상 관리 + 자동 발굴 API
│   │       ├── bgm_analyze.py   # BGM AI 분석 (섹션, 비트, 에너지 매칭)
│   │       ├── auto_project.py  # 자동 프로젝트 생성 (레퍼런스→프로젝트)
│   │       ├── video_analyze.py # 영상 분석 (씬 감지)
│   │       ├── presets.py       # 프리셋 관리
│   │       └── finished.py      # 완료 영상 관리
│   │
│   ├── db/                 # Supabase 클라이언트
│   └── presets/            # 프리셋 JSON 파일
│
├── scripts/
│   └── find_references.py  # 레퍼런스 자동 발굴 CLI (DB 학습 + Gemini + 인스타)
│
├── sdk/                    # 외부 연동 SDK (embed, API client)
├── assets/fonts/           # 자막용 폰트 파일
├── supabase/migrations/    # DB 스키마
└── docker-compose.yml
```

## 렌더링 파이프라인 (renderer.py)

```
Phase 1: 개별 클립 인코딩 (속도, 크롭, 줌, 이펙트 적용)
Phase 2: 트랜지션 + 연결 (xfade: fade, wipe, slide 등 9종)
Phase 3: 글로벌 이펙트 (밝기, 대비, 채도 등)
Phase 4: Ken Burns 줌/패닝 효과
Phase 5: 자막 오버레이 (Pillow 렌더 → ffmpeg overlay)
Phase 6: BGM 오디오 믹싱 (멀티클립 지원)
```

## AI 기능

### BGM 자동 매칭 (`/api/bgm/analyze`)
- 음원 섹션 분석 (intro, buildup, highlight, verse, bridge, outro)
- 비디오-오디오 에너지 커브 매칭
- 코러스 감지 (pychorus)
- 비트 스냅 (시작점을 비트에 정렬)

### 자동 프로젝트 생성 (`/api/auto-project/create`)
- 레퍼런스 영상 컷 구조 분석
- 소스 영상 자동 선택 (세션 그룹핑, 색상 필터, 무드 매칭)
- 비트 싱크 컷 생성
- BGM 하이브리드 스코어링 (에너지 35% + 섹션 25% + 코러스 20% + 비트 10% + 자연스러움 10%)

### 레퍼런스 자동 발굴 (`/api/references/discover`)
- DB 레퍼런스 분석 → Gemini로 패턴 프로필 생성
- 프로필 기반 새 영상 판별 (시각 요소 중심, overall≥8 AND visual≥7)
- 계정 기반 + 해시태그 기반 탐색

## API 요약

| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/projects | 프로젝트 목록/생성 |
| GET/PATCH/DELETE | /api/projects/{id} | 프로젝트 상세/수정/삭제 |
| POST | /api/render | 렌더링 시작 |
| GET | /api/render/status | 렌더링 상태 |
| POST | /api/bgm/analyze | BGM AI 분석 |
| POST | /api/bgm/sections | BGM 섹션 감지 |
| POST | /api/auto-project/create | 자동 프로젝트 생성 |
| GET/POST | /api/references/videos | 레퍼런스 영상 |
| POST | /api/references/discover | 레퍼런스 자동 탐색 |
| POST | /api/references/import | URL로 레퍼런스 임포트 |
| GET | /api/references/profile | 레퍼런스 프로필 조회 |
| POST | /api/upload | 미디어 업로드 |
| GET | /api/list-videos | 미디어 목록 |
| GET | /api/presets | 프리셋 목록 |

전체 API 문서는 서버 실행 후 http://localhost:8092/docs 에서 확인.

## 팀원 온보딩 (처음 세팅하는 분)

### 1분 세팅

```bash
git clone https://github.com/intellieffect/agentic-cms.git
cd agentic-cms/editor
make setup    # Python venv + npm install + .env 생성
```

### 환경변수 (.env)

프로젝트 관리자에게 아래 값을 받으세요:
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — DB 접속 (필수)
- `GEMINI_API_KEY` — AI 레퍼런스 분석 (선택)

영상 소스는 팀 공용 NAS에 있습니다. 아래 SMB를 연결하세요:

**SMB 연결 (macOS):**
1. Finder → 이동 → 서버에 연결 (Cmd+K)
2. `smb://192.168.219.52/Media/` 입력 → 연결
3. `/Volumes/Media/`로 자동 마운트됨

`.env`에서 별도 설정 불필요 — `/Volumes/Media`가 기본값으로 포함되어 있습니다.

### 실행

```bash
make dev   # FastAPI(8092) + Next.js(3100) 동시 실행
```

### 접속

| URL | 설명 |
|-----|------|
| http://localhost:3100 | 프로젝트 목록 (Next.js) |
| http://localhost:3100/studio?project=ID | 영상 에디터 |
| http://localhost:3100/dashboard | 경로 대시보드 |
| http://localhost:8092/docs | API 문서 (Swagger) |

### 프록시 시스템

DJI 원본(HEVC 4K)은 브라우저에서 느리므로 자동으로 H.264 720p 프록시를 생성합니다.
- 프리뷰: 프록시 사용 (부드러운 재생)
- 렌더링: 원본 사용 (최고 품질)
- 프록시는 `src/editor/_proxy/`에 자동 생성되며 git에 포함되지 않습니다.

### Remotion 렌더링

```bash
cd remotion
pnpm install   # 최초 1회
```

렌더링은 에디터 UI의 "렌더" 버튼으로 실행됩니다.

## 라이선스

Private repository.
