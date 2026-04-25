# ⚠️ editor/ 디렉토리 DEPRECATED — DO NOT EDIT FOR DASHBOARD CHANGES

## TL;DR

**dashboard 영상 편집기를 수정하려면 `editor/`가 아니라 `dashboard/src/components/`를 수정하세요.**

## 왜 DEPRECATED인가

- **2026-04-18**: brxce-editor가 agentic-cms로 이식되면서 `dashboard/src/components/{studio,remotion}/` 으로 fully ported됨
- **`editor/` 디렉토리는 historical reference로만 보존** (이식 source / standalone 사용 백업)
- dashboard는 editor를 import하지 않음 — `grep "from .*editor" dashboard/src` → 0건
- 같은 컴포넌트의 두 사본 (editor + dashboard) — 미세하게 다르게 진화함

## 자주 일어나는 실수

❌ 사용자가 "영상 편집기에 버그 있어요" 하면 `editor/components/...` 수정 → **dashboard 화면(`localhost:3000`)에 반영 안 됨**

✅ 영상 편집기 변경은 항상 `dashboard/src/components/{studio,remotion}/`에 적용

## 어디에 무엇이 있나

| 변경 대상 | 수정할 위치 | 사용 환경 |
|---|---|---|
| 영상 편집기 UI / 동작 | **`dashboard/src/components/studio/`** | http://localhost:3000 (운영) |
| Remotion preview 컴포넌트 | **`dashboard/src/components/remotion/`** | http://localhost:3000 (운영) |
| Timeline 동작 | **`dashboard/src/components/studio/timeline/`** + `Timeline.tsx` | http://localhost:3000 (운영) |
| editor sub-app standalone (port 3100) | `editor/components/...` | 개별 테스트만, 운영 외 |
| Remotion **render** (server-side ffmpeg + remotion bundler) | `editor/remotion/src/` | render server (Python에서 호출) |
| Python API (proxy/render) | `editor/src/server/` | port 8092 |

## render 경로는 여전히 editor/ 사용

- `editor/remotion/src/` — Remotion Studio + 서버 render bundle용 (Root.tsx 포함)
- 이것은 dashboard에 사본이 없음 — render는 editor의 Python API가 호출
- 따라서 **render 동작 변경 (예: VideoClip render 시 동작)** 은 `editor/remotion/src/`도 수정해야 함

## 변경 시 sync 가이드

| 변경 영역 | dashboard 사본 | editor sub-app 사본 | editor render 사본 |
|---|---|---|---|
| 영상 편집기 preview만 | `dashboard/src/components/{studio,remotion}/*` | (선택, standalone 안 쓰면 skip) | (영향 없음) |
| 영상 render도 영향 | `dashboard/src/components/remotion/*` | `editor/components/remotion/*` | `editor/remotion/src/*` ← **반드시** |

## 향후 정리 계획

이 디렉토리는 다음 중 하나로 정리될 예정:
- (a) editor sub-app 완전 deprecation → 해당 코드 제거 (render 코드만 별도 패키지로)
- (b) 단일 source 만들기 (workspace package + dashboard symlink)
- (c) 현 상태 유지 + sync 자동화 (CI check)

결정 전까지는 위 sync 가이드를 반드시 준수.
