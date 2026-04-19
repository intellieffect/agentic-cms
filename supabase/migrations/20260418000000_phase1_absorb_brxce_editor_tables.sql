-- ============================================================
-- Phase 1 — brxce-editor 테이블을 agentic-cms Supabase 에 흡수
-- (A-full 마이그레이션, 2026-04-18)
-- ============================================================
-- 이 마이그레이션은 brxce-editor code 가 agentic-cms Supabase 에
-- 연결했을 때 참조하는 모든 테이블을 누락 없이 생성한다.
-- 기존 데이터는 건드리지 않는다 (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- 주의 — 스키마 드리프트 반영:
-- brxce-editor 프로덕션 DB 는 001_init.sql 과 drift 된 상태였다:
--   • reference_accounts.id: UUID (migration) → TEXT (production, Instagram user id 사용)
--   • reference_videos.id: UUID → TEXT (Instagram post id 사용)
--   • reference_videos 에 music_artist / music_title 컬럼 추가 (미문서화)
--   • reference_accounts.username: NOT NULL → 빈 문자열("") 허용
-- 이 파일은 처음부터 프로덕션 실제 스키마를 반영한다 (UUID/NOT NULL 버전은 폐기).
-- ============================================================

-- ── projects: brxce-editor 호환용 workspace_id 컬럼 추가 ─────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id TEXT;

-- ── updated_at trigger 공용 함수 (brxce-editor 001_init 참조) ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── presets (brxce-editor 001_init) ─────────────────────────
CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  config JSONB NOT NULL DEFAULT '{}',
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── reference_accounts (TEXT id — Instagram user id 호환, username nullable) ──
CREATE TABLE IF NOT EXISTS reference_accounts (
  id             TEXT PRIMARY KEY,
  username       TEXT,          -- production 은 빈 문자열/null 허용
  display_name   TEXT,
  platform       TEXT DEFAULT 'instagram',
  avatar_url     TEXT,
  follower_count INT,
  category       TEXT,
  bio            TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_accounts_platform ON reference_accounts (platform);

-- ── reference_videos (TEXT id — Instagram post id, music_artist/title 포함) ──
CREATE TABLE IF NOT EXISTS reference_videos (
  id              TEXT PRIMARY KEY,
  account_id      TEXT REFERENCES reference_accounts(id),
  platform        TEXT,
  post_date       TIMESTAMPTZ,
  duration_sec    FLOAT,
  like_count      INT DEFAULT 0,
  comment_count   INT DEFAULT 0,
  view_count      INT,
  caption         TEXT,
  url             TEXT,
  thumbnail_url   TEXT,
  video_url       TEXT,
  style_tags      TEXT[],
  transition_tags TEXT[],
  music_tags      TEXT[],
  music_artist    TEXT,
  music_title     TEXT,
  notes           TEXT,
  favorite        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_videos_account ON reference_videos (account_id);
CREATE INDEX IF NOT EXISTS idx_ref_videos_style ON reference_videos USING GIN (style_tags);

DROP TRIGGER IF EXISTS trg_ref_videos_updated_at ON reference_videos;
CREATE TRIGGER trg_ref_videos_updated_at
  BEFORE UPDATE ON reference_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── render_jobs (brxce-editor 001_init) ─────────────────────
CREATE TABLE IF NOT EXISTS render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','rendering','done','failed')),
  output_url TEXT,
  progress FLOAT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_project ON render_jobs (project_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs (status);

-- ── reference_collections + items (brxce-editor create_carousels) ──
CREATE TABLE IF NOT EXISTS reference_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reference_collection_items (
  collection_id TEXT NOT NULL REFERENCES reference_collections(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, video_id)
);

-- ── reference_images (brxce-editor create_carousels) ────────
CREATE TABLE IF NOT EXISTS reference_images (
  id TEXT PRIMARY KEY,
  url TEXT,
  local_path TEXT,
  caption TEXT,
  tags TEXT[] DEFAULT '{}',
  source_platform TEXT,
  source_url TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reference_images_created_at ON reference_images (created_at DESC);

-- ── file_paths (brxce-editor resolver_paths) ────────────────
CREATE TABLE IF NOT EXISTS file_paths (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  bucket TEXT DEFAULT 'media',
  file_size BIGINT,
  content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(filename)
);

CREATE INDEX IF NOT EXISTS idx_file_paths_filename ON file_paths(filename);

-- ── Storage bucket: finished (brxce-editor 완료영상 보관) ────
INSERT INTO storage.buckets (id, name, public)
VALUES ('finished', 'finished', TRUE)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read finished') THEN
    CREATE POLICY "Public read finished"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'finished');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role manage finished') THEN
    CREATE POLICY "Service role manage finished"
      ON storage.objects FOR ALL
      USING (bucket_id = 'finished' AND auth.role() = 'service_role')
      WITH CHECK (bucket_id = 'finished' AND auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- Phase 1 종료.
-- 남은 이슈 — carousels 스키마 호환성:
--   agentic-cms.carousels: slides[] + variant_id 구조 (47 rows, 활발 사용)
--   brxce-editor.carousels: template/data/style_config/width/height 구조 (22 rows)
--   두 스키마는 변환 불가. brxce-editor 측 22 rows 는 이식에서 제외.
--   추후 필요 시 brxce_legacy_carousels 로 별도 테이블 만들고 수동 이관.
-- ============================================================
