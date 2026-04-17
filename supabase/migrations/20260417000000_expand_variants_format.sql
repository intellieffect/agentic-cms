-- Expand variants.format to include blog / newsletter / video
--
-- Reason: Content(master) → Variants(unified derivative registry) 구조로 전환.
-- 기존 blog_posts / newsletter_editions / carousels / video_projects 는 별도 테이블로 유지하되,
-- variants 테이블을 공통 진입점으로 삼기 위해 format enum을 확장한다.
-- (variant_id FK는 다음 이슈에서 각 format 테이블에 추가)

alter table variants
  drop constraint if exists variants_format_check;

alter table variants
  add constraint variants_format_check
  check (format in (
    'reel',
    'carousel',
    'single_post',
    'article',
    'thread',
    'story',
    'short',
    'blog',
    'newsletter',
    'video'
  ));
