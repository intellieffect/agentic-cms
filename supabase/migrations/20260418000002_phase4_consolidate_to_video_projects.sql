-- ============================================================
-- Phase 4 보정 — brxce-editor의 `projects` 테이블을 agentic-cms의
-- `video_projects` 테이블로 통합 (2026-04-18)
-- ============================================================
-- ⚠️ 이 migration 은 2026-04-18 brxce-editor 이식 1회성 operational
-- migration 이다. Fresh install 환경에서는:
--   • projects 테이블이 비어있어 INSERT 절이 no-op
--   • ALTER RENAME 이 projects → projects_legacy_pre_phase4_20260418 로 실행
--   • 실질적 변경은 video_projects.workspace_id 컬럼 추가 + FK 재지정 뿐
-- 이 파일의 주 목적은 "2026-04-18 당시 운영 환경에서 어떤 이관이 일어났는가"
-- 를 git history 에 고정하는 것. 신규 환경 셋업 시에는 Phase 1 migration 과
-- 향후 video_projects 직접 insert 만으로 충분하며 이 파일은 사실상 no-op.
--
-- 당시 상황: Phase 2에서 REST PostgREST UPSERT 로 brxce-editor 의 137 projects
-- rows 를 `projects` 테이블에 넣어둔 상태였는데, agentic-cms MCP/dashboard 는
-- `video_projects` 를 보고 있어서 `link_video_project_to_variant` 가 실패.
-- 아래 SQL 로 데이터/스키마/FK 를 video_projects 쪽으로 수렴시킴.
-- ============================================================

-- 1. video_projects 에 workspace_id 추가 (brxce-editor 호환)
ALTER TABLE video_projects ADD COLUMN IF NOT EXISTS workspace_id TEXT;

-- 2. 137개 projects → video_projects UPSERT (variant_id 는 건드리지 않음)
INSERT INTO video_projects (
  id, name, orientation, status, project_data, thumbnail_url,
  duration, clip_count, source_files, workspace_id, created_by,
  created_at, updated_at, deleted_at
)
SELECT
  id, name, orientation, status, project_data, thumbnail_url,
  duration, clip_count, source_files, workspace_id, created_by,
  created_at, updated_at, deleted_at
FROM projects
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  orientation   = EXCLUDED.orientation,
  status        = EXCLUDED.status,
  project_data  = EXCLUDED.project_data,
  thumbnail_url = EXCLUDED.thumbnail_url,
  duration      = EXCLUDED.duration,
  clip_count    = EXCLUDED.clip_count,
  source_files  = EXCLUDED.source_files,
  workspace_id  = EXCLUDED.workspace_id,
  created_by    = EXCLUDED.created_by,
  updated_at    = EXCLUDED.updated_at,
  deleted_at    = EXCLUDED.deleted_at;
  -- created_at, variant_id 는 의도적으로 업데이트 제외 (기존 값 보존)

-- 3. finished_videos / render_jobs FK 를 projects → video_projects 로 재지정
--    기존 FK 이름은 DB 마다 달라서 조회 후 drop.
DO $$
DECLARE
  fk_name text;
BEGIN
  -- finished_videos.project_id
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'finished_videos'::regclass
    AND contype = 'f'
    AND confrelid = 'projects'::regclass
  LIMIT 1;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE finished_videos DROP CONSTRAINT %I', fk_name);
  END IF;

  -- render_jobs.project_id
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'render_jobs'::regclass
    AND contype = 'f'
    AND confrelid = 'projects'::regclass
  LIMIT 1;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE render_jobs DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- 4. 새 FK 생성 (video_projects 기준)
ALTER TABLE finished_videos
  ADD CONSTRAINT finished_videos_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES video_projects(id);

ALTER TABLE render_jobs
  ADD CONSTRAINT render_jobs_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES video_projects(id);

-- 5. projects 테이블은 남겨둔다 (당장 drop 하면 롤백 불가).
--    Phase 6/7 에서 회귀 테스트 통과하면 수동으로 drop 하거나 별도 migration 에서 정리.
--    여기서는 이름만 변경해서 "더 이상 쓰지 않음" 을 명시.
ALTER TABLE projects RENAME TO projects_legacy_pre_phase4_20260418;

-- ============================================================
-- 검증 SQL (실행 후 확인용):
--   SELECT count(*) FROM video_projects;                      -- 137 + 기존 고유 = 140+
--   SELECT count(*) FROM projects_legacy_pre_phase4_20260418; -- 137 (백업)
--   SELECT conname, confrelid::regclass FROM pg_constraint WHERE conrelid = 'finished_videos'::regclass;
--   SELECT conname, confrelid::regclass FROM pg_constraint WHERE conrelid = 'render_jobs'::regclass;
-- ============================================================
