# AGENTS.md — brxce-editor

AI 코딩 에이전트를 위한 프로젝트 완전 가이드.
이 문서를 읽으면 프로젝트를 이해하고 기능 개발/버그 수정을 할 수 있다.

## 한줄 요약

AI 기반 숏폼 영상 편집기. **레퍼런스 영상 분석 → 소스 자동 매칭 → 비트 싱크 컷 → BGM 매칭 → 프로젝트 생성**까지 자동화.

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트 (에디터) | 바닐라 JS + HTML | `src/editor/`, 타임라인/재생/자막 |
| 프론트 (대시보드) | Next.js (React) | `app/`, 프로젝트 목록/레퍼런스 관리 |
| 백엔드 | FastAPI (Python 3.12+) | `src/server/` |
| 렌더링 | ffmpeg (직접 호출) | `renderer.py`, 6단계 파이프라인 |
| DB | Supabase (PostgreSQL + Storage) | `src/db/` |
| AI (오디오) | librosa, pychorus | BGM 분석/코러스 감지 |
| AI (영상) | Gemini API | 레퍼런스 판별/영상 분석 |

## 두 개의 UI 시스템

```
localhost:3100         → Next.js 대시보드
                          ├── / (프로젝트 목록, 생성)
                          ├── /references (레퍼런스 관리)
                          └── /editor?project={id} → iframe으로 아래 로드

localhost:8092         → FastAPI 서버
                          ├── /editor.html (실제 영상 편집기 UI)
                          ├── /api/* (모든 API)
                          └── /{file} (미디어 파일 서빙, Range 지원)
```

**흐름**: Next.js 대시보드에서 프로젝트 선택 → `editor.html?project={id}` 로드 → 바닐라 JS 에디터에서 편집 → API로 저장/렌더.

---

## 핵심 파이프라인: 자동 프로젝트 생성

```
POST /api/auto-project/create
  │
  ├─ 1. 레퍼런스 영상 다운로드 + 컷 구조 분석 (ffprobe scene detect)
  │     → cutDurations: [0.5, 1.2, 0.8, ...] (초)
  │
  ├─ 2. 소스 영상 스캔 + 선택
  │     → 세션 그룹핑 (DJI 타임스탬프 기반)
  │     → 색상 히스토그램 필터 (시각 이상치 제거)
  │     → 밝기/무드 매칭 (섹션 타입에 맞게)
  │
  ├─ 3. 비트 싱크 컷 생성 (BGM 있을 경우)
  │     → librosa beat_track → 비트 타임 추출
  │     → 레퍼런스 컷을 비트에 스냅 or 비트 기반 컷 자동 생성
  │
  ├─ 4. BGM 구간 자동 선택 (하이브리드 스코어링)
  │     → 숏폼(≤15s): 코러스/하이라이트 직행 + 비트 스냅
  │     → 롱폼(>15s): 에너지 35% + 섹션 25% + 코러스 20% + 비트 10% + 자연스러움 10%
  │
  └─ 5. 프로젝트 JSON 생성 → Supabase 저장
```

## 프로젝트 데이터 JSON 구조 (핵심!)

프론트와 백엔드 사이에 오가는 데이터. 이 구조를 알아야 기능 개발이 가능함.

```jsonc
{
  // ─── 클립 (타임라인에 배치된 영상 조각) ───
  "clips": [
    {
      "source": "DJI_20260324185851_0386_D.MP4",  // 파일명 (src/editor/ 또는 심볼릭 링크)
      "start": 0.1,      // 원본 영상에서 시작 시점 (초)
      "end": 3.5,         // 원본 영상에서 끝 시점 (초)
      "source_idx": 0     // 소스 인덱스 (내부용)
    }
  ],

  // ─── 클립별 메타데이터 ───
  "clipMeta": [{ "speed": 1 }],                          // 재생 속도 (1=정상, 2=2배속)
  "clipCrops": [{ "x": 0, "y": 0, "w": 100, "h": 100 }], // 크롭 (%)
  "clipZooms": [{ "scale": 1, "panX": 0, "panY": 0 }],    // 줌/패닝
  "clipEffects": [[]],                                      // 이펙트 배열
  "clipSubStyles": [{ "size": 16, "x": 50, "y": 80, "font": "'BMDOHYEON',sans-serif" }],

  // ─── 트랜지션 (클립 사이) ───
  "transitions": [
    { "type": "fade", "duration": 0.5 }  // none, fade, fadeblack, fadewhite, wipeleft, wiperight, wipeup, wipedown, slideleft, slideright
  ],

  // ─── 자막 ───
  "subs": [],               // 클립별 자막
  "globalSubs": [            // 글로벌 자막
    { "text": "텍스트", "start": 0, "end": 3, "style": { "size": 16, "x": 50, "y": 80 } }
  ],

  // ─── BGM ───
  "bgmClips": [
    {
      "id": "bgm_auto",
      "source": "Cha Cha Cha - Bruno Mars.mp3",  // 음원 파일명
      "start": 0,              // 타임라인 시작 위치 (초)
      "audioStart": 57.14,     // 음원에서 시작 위치 (초)
      "duration": 9.13,        // 사용 길이 (초)
      "totalDuration": 236.6,  // 음원 전체 길이
      "volume": 100,           // 0~100
      "sectionType": "chorus"  // 감지된 섹션 타입 (참고용)
    }
  ],

  // ─── 이펙트 ───
  "globalEffects": [],   // 글로벌 CSS 필터 이펙트
  "kbEffects": [],       // Ken Burns (줌/패닝 애니메이션)
  "fadeInOut": {
    "fadeIn": { "enabled": true, "duration": 0.3 },
    "fadeOut": { "enabled": true, "duration": 0.5 }
  },

  // ─── 메타 ───
  "sources": ["DJI_xxx.MP4", ...],  // 사용된 소스 파일 목록
  "totalDuration": 9.13,
  "referenceId": "uuid"             // 기반 레퍼런스 ID (auto-project 시)
}
```

## 미디어 파일 리졸버

영상 파일을 찾는 우선순위:
1. `src/editor/{filename}` (직접 또는 심볼릭 링크)
2. 레거시 경로 (`~/Desktop/_개발/brxce.ai/apps/studio/public/video-editor/`)
3. 리졸버 경로 매핑 (설정 파일 기반)
4. 소스 디렉토리 재귀 검색

외부 드라이브의 영상은 `src/editor/`에 심볼릭 링크로 연결:
```bash
ln -s /Volumes/Seagate/영상소스/DJI_xxx.MP4 src/editor/DJI_xxx.MP4
```

## 렌더링 파이프라인 (renderer.py, 1314줄)

```
run_render(data, BASE, render_status, render_lock)
  │
  ├─ Phase 1: 개별 클립 인코딩
  │   각 클립을 ffmpeg로 개별 MP4 생성 (속도, 크롭, 줌, 이펙트 적용)
  │
  ├─ Phase 2: 트랜지션 + concat
  │   ffmpeg xfade 필터로 트랜지션 적용 후 하나로 합침
  │
  ├─ Phase 3: 글로벌 이펙트
  │   전체 영상에 CSS 필터 스타일 이펙트 적용 (밝기, 대비, 채도 등)
  │
  ├─ Phase 4: Ken Burns
  │   moviepy로 줌/패닝 애니메이션 적용
  │
  ├─ Phase 5: 자막 오버레이
  │   Pillow로 자막 이미지 렌더 → ffmpeg overlay 필터로 합성
  │
  └─ Phase 6: BGM 믹싱
      멀티클립 BGM 오디오를 ffmpeg amix로 합성
```

## 핵심 파일 (수정 시 주의)

| 파일 | 줄수 | 역할 | 복잡도 |
|------|------|------|--------|
| `src/server/renderer.py` | 1314 | 렌더링 엔진 | ⚠️ 높음 |
| `src/server/routes/auto_project.py` | ~850 | 자동 프로젝트 생성 | ⚠️ 높음 |
| `src/server/routes/bgm_analyze.py` | ~550 | BGM AI 분석 | 중간 |
| `src/editor/index.html` | 큼 | 메인 에디터 UI | ⚠️ 전역변수 |
| `src/editor/js/bgm.js` | ~400 | BGM 트랙 UI | 중간 |
| `src/editor/js/playback.js` | ~200 | 재생/동기화 | 낮음 |

## 실행 환경

```bash
# 시스템 필수: ffmpeg, ffprobe, yt-dlp, node (v18+), python (3.12+)

# 두 서버 동시 실행
make dev

# 또는 수동
source .venv/bin/activate
python -m uvicorn src.server.app:app --host 0.0.0.0 --port 8092 &
npm run dev &
```

## 에디터 사용 플로우

사용자가 에디터를 쓰는 흐름. 기능 개발 시 이 컨텍스트를 이해해야 함.

```
1. localhost:8092/editor.html 접속
2. 왼쪽 패널 드롭존에 영상 드래그 앤 드롭 → POST /api/upload → src/editor/에 저장
3. 소스 목록에서 영상을 타임라인으로 드래그 → CLIPS 배열에 추가
4. 타임라인에서 트림/분할/속도/크롭/줌 편집 → 클라이언트 JS로 처리
5. BGM 트랙에 음원 드래그 → POST /api/upload → BGM_CLIPS에 추가
6. "자동 구간 찾기" → POST /api/bgm/analyze → 서버에서 librosa 분석 → 추천 결과 표시
7. 자막/트랜지션/이펙트 추가 → 클라이언트 JS
8. "렌더" 클릭 → POST /api/render → 서버에서 renderer.py 6단계 → MP4 생성 → 다운로드
9. "저장" → POST /api/projects/save → DB + 로컬 JSON 동시 저장
```

미디어 파일 업로드 시 `src/editor/`에 직접 저장됨. 이미지는 자동으로 정지 영상 클립(MP4)으로 변환.

## 테스트 방법

```bash
# API 테스트
curl http://localhost:8092/api/projects  # 프로젝트 목록
curl http://localhost:8092/docs          # Swagger UI

# BGM 분석 테스트
curl -X POST http://localhost:8092/api/bgm/sections \
  -H "Content-Type: application/json" \
  -d '{"source": "음원파일.mp3"}'

# 레퍼런스 프로필 확인
curl http://localhost:8092/api/references/profile

# 레퍼런스 자동 탐색 (Gemini API 키 필요)
curl -X POST http://localhost:8092/api/references/discover \
  -H "Content-Type: application/json" \
  -d '{"mode": "auto", "limit": 5}'
```

## 코드 수정 워크플로우 (필수!! 절대 건너뛰지 마라!!)

main 직접 push 금지. **예외 없음.** 모든 변경은 아래 순서를 반드시 따른다:

```
1. gh issue create --title "제목" --body "설명"
   → 이슈 번호 확인 (#N)

2. git checkout -b {fix|feat|chore}/이슈번호-설명
   예: feat/18-zoom-animation, fix/19-proxy-broken

3. 코드 수정 + 중간 커밋 (기능 단위로 쪼개서!)
   - 한 커밋에 30개 파일 금지. 기능별로 분리.
   - 커밋 메시지: feat/fix 접두사, "Fixes #N"

4. 자체 코드 리뷰 (PR 전 필수!)
   - git diff --stat 으로 변경 범위 확인
   - 변경된 파일마다 실제로 의도한 변경인지 점검
   - 빌드 확인: npx tsc --noEmit --skipLibCheck
   - 브라우저에서 기능 동작 확인

5. git push → gh pr create
   - PR 본문에 변경사항 + 테스트 결과 명시

6. PR 코드 리뷰 (머지 전 필수!)
   - gh pr diff 로 전체 diff 확인
   - 회귀버그 없는지 점검
   - 불필요한 변경/디버그 코드 제거 확인

7. 리뷰 통과 후: gh pr merge --squash --delete-branch
```

### ⚠️ 절대 하지 말 것
- 이슈 없이 코드 수정 시작 ❌
- 30개 파일 한꺼번에 커밋 ❌
- 코드 리뷰 없이 머지 ❌
- 빌드 확인 없이 PR ❌
- 브라우저 테스트 없이 "완료" 보고 ❌
- `gh pr create && gh pr merge` 한 줄 실행 ❌ ← **5번과 7번 사이에 반드시 리뷰!**

### ⛔ 금지 패턴 (2026-03-27 교훈)
```bash
# 이거 절대 하지 마라!! PR 생성하자마자 머지 = 코드 리뷰 건너뜀
gh pr create ... && gh pr merge --squash --delete-branch
```
**5번(PR 생성) → 6번(코드 리뷰) → 7번(머지)은 반드시 별도 단계로 실행한다.**
리뷰 단계에서는 `gh pr diff`로 전체 diff를 확인하고, 리뷰 결과를 코멘트로 남긴다.

## 확장 포인트

| 하고 싶은 것 | 수정 위치 |
|-------------|----------|
| 새 API 라우트 | `src/server/routes/`에 파일 → `app.py`에 라우터 등록 |
| 새 에디터 기능 | `src/editor/js/`에 모듈 → `index.html`에서 로드 |
| 새 트랜지션 | `renderer.py` Phase 2의 `VALID_XFADE` 세트에 추가 |
| 새 프리셋 | `src/presets/`에 JSON |
| DB 변경 | `supabase/migrations/`에 SQL |
| 새 AI 기능 | 백엔드 라우트 + (선택) 프론트 UI |

## 현재 상태 & 알려진 이슈

| 기능 | 완성도 | 비고 |
|------|--------|------|
| 에디터 UI | 90% | 타임라인, BGM, 자막, 이펙트 동작 |
| 렌더링 | 95% | 6단계 파이프라인 안정 |
| BGM 자동 매칭 | 90% | 하이브리드 스코어링 적용 |
| 자동 프로젝트 생성 | 85% | 비트 싱크 + 무드 매칭 동작 |
| 레퍼런스 자동 발굴 | 90% | DB 학습 + 시각 기반 판별 |
| 인스타 세션 | 불안정 | 쿠키 만료 빈번, 계정 기반 탐색 제한적 |
| Gemini rate limit | 주의 | 무료 tier 제한, 3초 간격 + 자동 재시도 구현됨 |

## 커밋 컨벤션

`feat:` / `fix:` / `chore:` / `refactor:` — 한글 OK, `Fixes #N`으로 이슈 자동 클로즈, squash merge.
