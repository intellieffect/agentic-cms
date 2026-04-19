-- ============================================================
-- 통합 레퍼런스 시스템 (캐러셀 + 영상 + 향후 확장)
-- ============================================================

-- 1. ref_accounts — 레퍼런스 계정 (통합)
CREATE TABLE IF NOT EXISTS ref_accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  bio TEXT,
  platform TEXT DEFAULT 'instagram',
  follower_count INTEGER,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ref_posts — 레퍼런스 게시물 (통합)
CREATE TABLE IF NOT EXISTS ref_posts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ref_accounts(id),
  post_type TEXT NOT NULL DEFAULT 'carousel',
  post_date DATE,
  platform TEXT DEFAULT 'instagram',
  url TEXT,

  -- 공통 메트릭
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER,
  caption TEXT,

  -- 캐러셀 전용
  slide_count INTEGER DEFAULT 1,
  layout_pattern TEXT,
  hook_type TEXT,
  cta_type TEXT,

  -- 영상 전용
  duration_sec INTEGER,
  thumbnail_url TEXT,
  video_url TEXT,

  -- 분석 태그 (공통)
  style_tags TEXT,
  topic_tags TEXT,
  transition_tags TEXT,
  music_tags TEXT,

  -- 메타
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_posts_account ON ref_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_ref_posts_type ON ref_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_ref_posts_platform ON ref_posts(platform);

-- 3. ref_slides — 슬라이드/프레임
CREATE TABLE IF NOT EXISTS ref_slides (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES ref_posts(id) ON DELETE CASCADE,
  slide_index INTEGER NOT NULL,
  media_url TEXT,
  media_type TEXT DEFAULT 'image',
  template_type TEXT,
  has_text_overlay BOOLEAN DEFAULT false,
  dominant_color TEXT,
  notes TEXT,
  UNIQUE(post_id, slide_index)
);

CREATE INDEX IF NOT EXISTS idx_ref_slides_post ON ref_slides(post_id);

-- 4. Storage 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('references', 'references', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read references'
  ) THEN
    CREATE POLICY "Public read references"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'references');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role manage references'
  ) THEN
    CREATE POLICY "Service role manage references"
      ON storage.objects FOR ALL
      USING (bucket_id = 'references' AND auth.role() = 'service_role')
      WITH CHECK (bucket_id = 'references' AND auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- 기존 reference_videos / reference_accounts → ref_posts 데이터 마이그레이션
-- ============================================================

-- 기존 reference_accounts → ref_accounts
INSERT INTO ref_accounts (id, display_name, platform, created_at)
SELECT
  ra.id,
  ra.display_name,
  COALESCE(ra.platform, 'instagram'),
  COALESCE(ra.created_at, now())
FROM reference_accounts ra
WHERE NOT EXISTS (SELECT 1 FROM ref_accounts WHERE id = ra.id)
ON CONFLICT (id) DO NOTHING;

-- 기존 reference_videos → ref_posts (post_type = 'video')
INSERT INTO ref_posts (
  id, account_id, post_type, post_date, platform, url,
  like_count, comment_count, view_count, caption,
  duration_sec, thumbnail_url, video_url,
  style_tags, topic_tags, transition_tags, music_tags,
  notes, created_at, updated_at
)
SELECT
  rv.id,
  rv.account_id,
  'video',
  rv.post_date,
  COALESCE(rv.platform, 'instagram'),
  rv.url,
  COALESCE(rv.like_count, 0),
  COALESCE(rv.comment_count, 0),
  rv.view_count,
  rv.caption,
  rv.duration_sec,
  rv.thumbnail_url,
  rv.video_url,
  rv.style_tags::TEXT,
  rv.topic_tags::TEXT,
  rv.transition_tags::TEXT,
  rv.music_tags::TEXT,
  rv.notes,
  COALESCE(rv.created_at, now()),
  COALESCE(rv.updated_at, now())
FROM reference_videos rv
WHERE rv.account_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM ref_accounts WHERE id = rv.account_id)
  AND NOT EXISTS (SELECT 1 FROM ref_posts WHERE id = rv.id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage 경로 규칙:
--   references/{account_id}/{post_id}/thumbnail.jpg
--   references/{account_id}/{post_id}/video.mp4
--   references/{account_id}/{post_id}/slide-{index}.jpg
-- ============================================================
