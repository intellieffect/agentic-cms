-- Link format-specific detail tables to the unified variants registry.
--
-- Reason: Content(master) → Variants(unified derivative registry) 구조 전환.
-- blog_posts / carousels / video_projects 는 각자 독립 테이블로 유지하고,
-- variants 테이블이 "파생물 레지스트리" 역할을 하도록 각 테이블에 variant_id FK 를 건다.
--
-- email_logs 는 뉴스레터 발송 배치. 뉴스레터를 별도 format 으로 두는 대신
-- format=blog 인 variant 를 이메일로 보냈다는 관계로 추적한다.
-- email_logs 는 "같은 variant 를 여러 번 발송" 가능하므로 1:N 관계 (UNIQUE 제약 없음).
--
-- blog_posts / carousels / video_projects 는 "1 variant = 1 상세 레코드" 인 1:1 관계:
--   같은 variant 가 두 개의 blog_post 에 연결되는 것은 의미상 잘못됨.
--   partial UNIQUE index 로 NULL 은 중복 허용 + NOT NULL 값만 유일성 강제.
--
-- 전 컬럼 NULL 허용: 기존 데이터(blog_posts 17행 등) 는 variant 없이도 유효해야 하므로.
-- backfill(기존 레코드를 variants 에 역 매핑) 은 별도 이슈에서 수동/에이전트 작업으로 진행.

alter table blog_posts
  add column if not exists variant_id uuid references variants(id) on delete set null;

alter table carousels
  add column if not exists variant_id uuid references variants(id) on delete set null;

alter table video_projects
  add column if not exists variant_id uuid references variants(id) on delete set null;

alter table email_logs
  add column if not exists variant_id uuid references variants(id) on delete set null;

-- 1:1 관계 (variant ↔ 상세 레코드). NULL 중복은 partial index 로 허용.
create unique index if not exists uq_blog_posts_variant_id
  on blog_posts(variant_id)
  where variant_id is not null;

create unique index if not exists uq_carousels_variant_id
  on carousels(variant_id)
  where variant_id is not null;

create unique index if not exists uq_video_projects_variant_id
  on video_projects(variant_id)
  where variant_id is not null;

-- 1:N 관계. non-unique index 만 추가.
create index if not exists idx_email_logs_variant_id on email_logs(variant_id);
