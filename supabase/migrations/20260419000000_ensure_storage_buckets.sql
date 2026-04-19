-- ============================================================
-- Multi-tenant fresh-install 보호 — 필수 Storage bucket 자동 생성
-- (2026-04-19, 멀티테넌트 onboarding gap fix)
-- ============================================================
-- 신규 고객이 빈 Supabase 프로젝트에 migrations 를 적용하면 아래 5개 bucket 이
-- 자동 생성되도록 보장. 기존 배포(이미 bucket 있는 경우) 는 ON CONFLICT 로 멱등.
--
-- bucket 목적:
--   content-media   — 콘텐츠 첨부 이미지/미디어
--   studio-renders  — 캐러셀/영상 편집 스튜디오 렌더 결과
--   references      — 영상 편집 레퍼런스 (썸네일/영상)
--   finished        — 완료 영상 (공개 URL 로 서빙)
--   blog-images     — 블로그 포스트 썸네일/본문 이미지
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('content-media', 'content-media', TRUE),
  ('studio-renders', 'studio-renders', TRUE),
  ('references', 'references', TRUE),
  ('finished', 'finished', TRUE),
  ('blog-images', 'blog-images', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── RLS 정책: 공개 읽기 + service_role 전체 관리 ──
-- bucket 별로 정책 추가. 기존 정책이 있으면 skip.
DO $$
DECLARE
  b text;
BEGIN
  FOR b IN SELECT unnest(ARRAY['content-media', 'studio-renders', 'references', 'finished', 'blog-images']) LOOP
    -- Public read
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = format('Public read %s', b)
    ) THEN
      EXECUTE format($f$CREATE POLICY "Public read %s" ON storage.objects FOR SELECT USING (bucket_id = %L)$f$, b, b);
    END IF;

    -- Service role full access
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = format('Service role manage %s', b)
    ) THEN
      EXECUTE format(
        $f$CREATE POLICY "Service role manage %s" ON storage.objects FOR ALL USING (bucket_id = %L AND auth.role() = 'service_role') WITH CHECK (bucket_id = %L AND auth.role() = 'service_role')$f$,
        b, b, b
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 검증 SQL:
--   SELECT id, name, public FROM storage.buckets ORDER BY id;
--   SELECT policyname FROM pg_policies WHERE tablename = 'objects' ORDER BY policyname;
-- ============================================================
