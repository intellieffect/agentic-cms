-- AWC Gallery SEO/AEO 메타 확장 (2026-04-26)
--
-- 갤러리 SEO/AEO/GEO 리서치(/research 3엔진 [3/3] consensus) 결과 식별된 5개 갭 채움:
--   (1) AI 라벨 — IPTC `digitalSourceType=trainedAlgorithmicMedia` 표시 여부.
--       Google "About this image" + Meta + LinkedIn CR 아이콘 자동 라벨링 트리거.
--       2025-12 EU AI Code (2026-06 final) 권장. AWC 갤러리는 AI 산출물 기본 가정 → default true.
--   (2) ai_model — 선택. 사용된 모델명(gpt-image-2 / kling-1.6 / veo-3.1 등).
--       summary 메타라인(제작 시간·외주 단가)과 짝. ImageObject/VideoObject creditText 보강용.
--   (3) transcript — 영상 한글 transcript. Perplexity·ChatGPT·Gemini multimodal citation 친화.
--       VideoObject `transcript` 프로퍼티 + 페이지 본문 accordion + (옵션) WebVTT track 출력.
--   (4) duration_seconds — 짧은 hero 영상 정확도. 기존 duration_minutes는 분 단위라
--       9초·15초 영상에 부적합. VideoObject duration ISO 8601 `PT{n}S` 출력에 사용.
--   (5) cover_poster_url — cover 영상의 poster JPG URL.
--       Chrome 116+ 부터 poster 가 video LCP 측정에 기여. og:video:image 와 동기화.

alter table gallery_items
  add column if not exists is_ai_generated boolean default true,
  add column if not exists ai_model text,
  add column if not exists transcript text,
  add column if not exists duration_seconds integer,
  add column if not exists cover_poster_url text;

-- 기존 row 일괄 적용 (default 는 신규 row 에만 적용되므로 명시 update 필요)
update gallery_items set is_ai_generated = true where is_ai_generated is null;

comment on column gallery_items.is_ai_generated is 'IPTC digitalSourceType=trainedAlgorithmicMedia 표시 여부. default true (AWC 갤러리 기본 가정).';
comment on column gallery_items.ai_model is '선택. 사용된 모델명(예: gpt-image-2, kling-1.6, veo-3.1).';
comment on column gallery_items.transcript is '영상 한글 transcript. Perplexity/Gemini multimodal citation 친화.';
comment on column gallery_items.duration_seconds is '영상 길이(초). 짧은 hero 영상 정확도 — VideoObject duration ISO8601 PT{n}S 출력에 사용.';
comment on column gallery_items.cover_poster_url is 'cover 영상의 poster JPG URL. Chrome 116+ video LCP 기여 + og:video:image 동기화.';
