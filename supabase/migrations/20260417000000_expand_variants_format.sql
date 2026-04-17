-- Expand variants.platform + variants.format and reconcile with actual DB state.
--
-- 배경:
--   20260401 migration 의 check constraint 와 실제 DB 데이터가 불일치하는 것이 확인됨.
--     · 실제 platform 값: 'twitter', 'linkedin'   (migration: 'instagram'…'x')
--     · 실제 format 값:   'post', 'thread'        (migration: 'single_post'…'short')
--   누군가 수동으로 constraint 를 완화했거나 migration 이 production 에 적용되지 않은 것으로 보인다.
--
-- 본 migration 은 세 가지를 한 번에 처리한다:
--   1) 기존 비표준 데이터 정규화 ('twitter'→'x', 'post'→'single_post')
--   2) 기존 check constraint 들을 동적으로 찾아 drop (이름을 하드코딩하지 않는다)
--   3) 새 check constraint 재생성 — Content(master) → Variants(registry) 구조에 필요한
--      blog / video 포맷, blog / email / self 채널을 추가
--
-- 뉴스레터는 별도 format 이 아니다. 현재 구조상 blog_posts 를 이메일로 발송하는 행위에 가깝고,
-- 다음 단계에서 email_logs.variant_id 로 "어떤 blog variant 가 메일로 나갔는지" 를 추적한다.

-- ────────────────────────────────
-- 1) 기존 비표준 데이터 정규화
-- ────────────────────────────────
update variants set platform = 'x'           where platform = 'twitter';
update variants set format   = 'single_post' where format   = 'post';

-- ────────────────────────────────
-- 2) 기존 check constraint 동적 drop
-- ────────────────────────────────
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.variants'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%platform%in%(%';
  if cname is not null then
    execute 'alter table public.variants drop constraint ' || quote_ident(cname);
  end if;
end$$;

do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.variants'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%format%in%(%';
  if cname is not null then
    execute 'alter table public.variants drop constraint ' || quote_ident(cname);
  end if;
end$$;

-- ────────────────────────────────
-- 3) 새 check constraint 재생성
-- ────────────────────────────────
alter table variants
  add constraint variants_platform_check
  check (platform in (
    -- 소셜
    'instagram', 'linkedin', 'threads', 'tiktok', 'youtube', 'x',
    -- 자사 채널
    'blog',  -- 자체 블로그 (blog_posts 로 연결)
    'email', -- 뉴스레터/이메일 (email_logs 로 연결)
    'self'   -- 자사 기타 채널 (랜딩 페이지, 문서 등)
  ));

alter table variants
  add constraint variants_format_check
  check (format in (
    -- 기존 (소셜 short/long form)
    'reel', 'carousel', 'single_post', 'article', 'thread', 'story', 'short',
    -- 신규
    'blog',  -- blog_posts 행과 1:1
    'video'  -- 자사 landscape 영상 (brxce-editor 렌더링 결과, video_projects 와 연결)
  ));

comment on column variants.platform is
  'Distribution channel. 소셜: instagram/linkedin/threads/tiktok/youtube/x. 자사: blog(blog_posts), email(email_logs), self(기타).';

comment on column variants.format is
  'Content format. short = YouTube Short / TikTok short-form. video = 자사 landscape 영상 (video_projects 연결). blog = blog_posts 1:1.';
