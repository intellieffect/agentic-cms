-- gallery `kinds` enum 정리: 미디어 포맷 축(image/video/carousel) 제거.
--
-- 배경: 기존 enum이 두 축(용도/주제 + 미디어 포맷)을 혼합 보유.
--   image/video는 cover_media.mime_type 으로 자동 판정 가능 → kind enum 중복.
--   carousel은 사용 0건. 제거해도 영향 없음.
--
-- 신 enum: landing / ad / case_study / ai_influencer / other
-- 미디어 포맷 필터는 cover_media.mime_type prefix 매칭으로 별도 처리.
--
-- 데이터 마이그레이션은 본 migration 적용 전 별도 UPDATE로 선처리됨
-- (image/video/carousel 제거 + miumiu-matelasse-wallet 'image' → 'ad' 재분류).
-- 본 migration 시점에 모든 published row 의 kinds 가 신 enum 안에 있다고 가정.
--
-- backward-compat 트리거(`fn_gallery_kinds_sync`) 와 `kind` 단일 컬럼은 유지
-- (양 레포 일부 코드가 여전히 fallback 으로 사용). cleanup 별건.

ALTER TABLE gallery_items DROP CONSTRAINT IF EXISTS gallery_items_kind_check;
ALTER TABLE gallery_items DROP CONSTRAINT IF EXISTS gallery_items_kinds_valid;

ALTER TABLE gallery_items
  ADD CONSTRAINT gallery_items_kind_check
    CHECK (kind = ANY (ARRAY[
      'landing', 'ad', 'case_study', 'ai_influencer', 'other'
    ]::text[]));

ALTER TABLE gallery_items
  ADD CONSTRAINT gallery_items_kinds_valid
    CHECK (
      cardinality(kinds) >= 1
      AND kinds <@ ARRAY[
        'landing', 'ad', 'case_study', 'ai_influencer', 'other'
      ]::text[]
    );
