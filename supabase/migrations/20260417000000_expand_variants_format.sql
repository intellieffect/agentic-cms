-- Expand variants.format to include blog / video
--
-- Reason: Content(master) → Variants(unified derivative registry) 구조로 전환.
-- 기존 blog_posts / carousels / video_projects 는 별도 테이블로 유지하되,
-- variants 테이블을 공통 진입점으로 삼기 위해 format enum을 확장한다.
-- (variant_id FK는 다음 이슈에서 각 format 테이블에 추가)
--
-- Newsletter는 별도 format으로 넣지 않는다. 현재 구조상 뉴스레터는 독립 콘텐츠 테이블이 없고
-- blog_posts를 이메일로 발송하는 행위에 가까우므로, 다음 단계에서 email_logs 에 variant_id FK 를
-- 추가해 "어떤 블로그 variant가 메일로 발송됐는지" 로 추적한다.

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
    'video'
  ));
