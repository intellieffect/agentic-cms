-- gallery `research` kind 신설.
--
-- 배경: 4/26 PR #53 정제로 enum 5축(landing/ad/case_study/ai_influencer/other) 확정.
--   외부 플랫폼 분석·디자인 시스템 보고서 등 "AWC가 만든 리서치 산출물"을 case_study로 묶기 어려움.
--   case_study = AWC가 만든 작업물(시안/랜딩 등) / research = AWC가 분석한 외부 대상 — 분류 기준 분리.
--
-- 신 enum: landing / ad / case_study / ai_influencer / research / other (6축)

ALTER TABLE gallery_items DROP CONSTRAINT IF EXISTS gallery_items_kind_check;
ALTER TABLE gallery_items DROP CONSTRAINT IF EXISTS gallery_items_kinds_valid;

ALTER TABLE gallery_items
  ADD CONSTRAINT gallery_items_kind_check
    CHECK (kind = ANY (ARRAY[
      'landing', 'ad', 'case_study', 'ai_influencer', 'research', 'other'
    ]::text[]));

ALTER TABLE gallery_items
  ADD CONSTRAINT gallery_items_kinds_valid
    CHECK (
      cardinality(kinds) >= 1
      AND kinds <@ ARRAY[
        'landing', 'ad', 'case_study', 'ai_influencer', 'research', 'other'
      ]::text[]
    );
