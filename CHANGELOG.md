# CHANGELOG

모든 마이그레이션·구조 변경 중 되돌릴 수 없는 결정은 여기에 기록.
(코드 diff 는 git log 가 진실의 원천, 이 파일은 "왜" + "어떤 부채가 생겼나" 를 기록.)

---

## 2026-04-18 — brxce-editor 이식 (A-full migration)

### 요약
외부 의존이었던 `~/Projects/brxce-editor` (Python FastAPI, 독립 Supabase 프로젝트) 를 agentic-cms 안으로 완전히 이식.
UI proxy 통합 → 실제 "포함" 으로 전환.

### Before
- `~/Projects/brxce-editor/` (별도 repo, Git 독립)
- Supabase project: `kjyqcisefaojeqnjieyu` (137 projects, 53+60+24 references/accounts/finished, 53+26 storage files)
- agentic-cms Supabase: `euhxmmiqfyptvsvvbbvp` (topics/ideas/contents/variants/blog_posts/carousels 등 — 영상 관련 데이터도 24 rows 가 stale snapshot 으로 존재)
- 연결 방식: dashboard 가 iframe / HTTP proxy 로 8092 포트의 brxce-editor 접근. `link_video_project_to_variant` 는 video_projects FK 를 agentic-cms DB 에서 찾도록 설계돼 있었으나 실제 데이터는 brxce-editor DB 에 있어 "video_project not found" 반환.

### After
- `~/Projects/agentic-cms/editor/` (agentic-cms repo 안의 서브디렉토리, 자체 .venv)
- Supabase 단일: `euhxmmiqfyptvsvvbbvp` — brxce-editor 테이블 전량 흡수
- 실행: `cd dashboard && npm run dev:all` → Next(3003) + Python editor(8092) 동시 기동 (concurrently)
- `link_video_project_to_variant` 정상 작동 — 방금 검증 완료

### Phase 별 진행
- Phase 0: 양쪽 Supabase + Storage 전량 JSON 백업 (24MB, 48 files). 경로: `~/Projects/agentic-cms-migration-backup-20260418_175734/`
- Phase 1: agentic-cms Supabase 에 누락 테이블 9개 생성. migration: `20260418000000_phase1_absorb_brxce_editor_tables.sql` (작업 중 id 타입 드리프트 발견 — reference_accounts/reference_videos 는 UUID 아닌 TEXT 사용, music_artist/music_title 컬럼 미문서화. 원래 별도 보정 migration `20260418000001` 파일로 DROP+RECREATE 했으나, 이후 PR 정리 시 M_A 를 처음부터 TEXT id 로 재작성하고 M_B 파일은 삭제 — 프로덕션은 M_A+M_B 순차 실행으로 이미 수렴. fresh install 은 갱신된 M_A 만으로 동일 결과)
- Phase 2: 4 테이블 UPSERT (projects 137, reference_accounts 60, reference_videos 53, finished_videos 23→24)
- Phase 3: Storage 114 files / 522MB 이관 (references 64, finished 50). 6-worker 병렬 51초.
- Phase 4: 코드 이동 (`~/Projects/brxce-editor` → `agentic-cms/editor`) + env 교체 (SUPABASE_URL, TABLE_PROJECTS=video_projects). migration: `20260418000002_phase4_consolidate_to_video_projects.sql` — projects → video_projects 통합, 원본 `projects` 는 `projects_legacy_pre_phase4_20260418` 로 rename (롤백 safety).
- Phase 5: `dashboard/scripts/start-editor.js` PORT 고정화 (기본 8092) + `npm run dev:all` 검증.
- Phase 6: 전면 회귀 테스트 — MCP 43 tools, editor API 5 routes, dashboard 9 pages 전부 HTTP 200.
- Phase 6.5: `finished_videos` 24 rows 전부 로컬 Desktop 경로 → Supabase Storage URL 로 정규화. 9개 local-only 파일을 Storage 업로드. `editor/.env` 에서 `FINISHED_DIR` 제거 + `STORAGE_MODE=cloud` 설정 (신규 렌더는 자동으로 Storage 만 사용).
- Phase 7: 문서 정리 + 은퇴 스케줄 기록 (이 파일).

### 남은 부채 / 향후 정리 예정
1. **`projects_legacy_pre_phase4_20260418` 테이블** — Phase 4 롤백 안전망. 회귀 테스트 1주일 지켜보고 이상 없으면 2026-05-18 이후 DROP. 이 파일에 DROP 완료 기록 추가할 것.
2. **brxce-editor Supabase 프로젝트 `kjyqcisefaojeqnjieyu`** — 2026-05-02 이후 Supabase dashboard 에서 archive, 2026-06-01 이후 delete. 이전까지는 recovery 용으로 유지.
3. **brxce-editor.carousels 22 rows 미이관** — brxce 스키마(`id/title/template/data/style_config/width/height`) 와 agentic-cms 스키마(`id/title/caption/slides[]/variant_id`) 가 호환 불가. 이번 이식에서 의도적 제외. 해당 데이터 복구 필요 시 brxce Supabase 에서 직접 export → 변환 스크립트 작성 → `brxce_legacy_carousels` 테이블에 수동 import. 현재는 사용자가 해당 데이터 활용 안 한다고 판단.
4. **`finished` bucket storage orphan 11 files** — DB row 없는 파일. 사용자 확인 후 개별 삭제 결정. 현재 용량 부담 적어 즉시 정리 불필요.
5. **`list_video_projects` MCP 도구 응답 크기** — project_data JSONB 를 통째로 반환해서 25k 토큰 초과. summary-only 옵션 추가 필요. 다음 MCP 개선 시 작업.
6. **editor `/api/finished/list` route shadowing** — FastAPI 가 `/api/finished/{video_id}` 와 매칭해서 500 반환 (프로덕션 코드는 `/api/finished` 사용해서 영향 없음). 코드 정리 시 `/api/finished/list` 를 먼저 등록하거나 제거.
7. **Storage orphan cleanup script** — DB referential integrity 체크 후 orphan 파일 자동 정리 cron/도구 필요 (재발 방지).
8. **editor/ 디렉토리 git-level 이식** — 2026-04-18 파일시스템 레벨 이동만 완료. brxce-editor 의 `.git/`·`.venv/`·`node_modules/`·미디어 파일 등 포함 상태 (약 11GB). 별도 PR 에서 cleanup → add. 완료 시 이 항목 제거.

### 폐기된 구조 문서 레퍼런스
- `~/Projects/brxce-editor` 경로를 언급하는 문서는 전부 `~/Projects/agentic-cms/editor` 로 업데이트돼야 함.
- brxce-editor Supabase URL (`kjyqcisefaojeqnjieyu`) 언급 env / 설정 파일은 삭제 또는 agentic-cms Supabase URL 로 교체.
