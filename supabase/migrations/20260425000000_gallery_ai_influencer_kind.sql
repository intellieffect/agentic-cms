-- Add 'ai_influencer' to gallery_items kind/kinds CHECK constraints.
-- Backward-compat: 기존 row·코드 영향 없음 (enum 확장만).
-- 쌍 PR(brxce.ai) 과 순서 무관 — kind 확장은 AWC Web 쪽 코드 변경 없이도 안전.

ALTER TABLE gallery_items DROP CONSTRAINT IF EXISTS gallery_items_kind_check;
ALTER TABLE gallery_items DROP CONSTRAINT IF EXISTS gallery_items_kinds_valid;

ALTER TABLE gallery_items
  ADD CONSTRAINT gallery_items_kind_check
    CHECK (kind = ANY (ARRAY[
      'landing', 'video', 'ad', 'image', 'carousel', 'case_study', 'other', 'ai_influencer'
    ]::text[]));

ALTER TABLE gallery_items
  ADD CONSTRAINT gallery_items_kinds_valid
    CHECK (
      cardinality(kinds) >= 1
      AND kinds <@ ARRAY[
        'landing', 'video', 'ad', 'image', 'carousel', 'case_study', 'other', 'ai_influencer'
      ]::text[]
    );
