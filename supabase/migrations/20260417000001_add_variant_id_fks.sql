-- Link format-specific detail tables to the unified variants registry.
--
-- Reason: Content(master) → Variants(unified derivative registry) 구조 전환.
-- blog_posts / carousels / video_projects 는 각자 독립 테이블로 유지하고,
-- variants 테이블이 "파생물 레지스트리" 역할을 하도록 각 테이블에 variant_id FK 를 건다.
--
-- email_logs 는 뉴스레터 발송 배치. 뉴스레터를 별도 format 으로 두는 대신
-- format=blog 인 variant 를 이메일로 보냈다는 관계로 추적한다.
--
-- 전 컬럼 NULL 허용: 기존 데이터(blog_posts 17행 등)는 variant 없이도 유효해야 하므로.

alter table blog_posts
  add column if not exists variant_id uuid references variants(id) on delete set null;

alter table carousels
  add column if not exists variant_id uuid references variants(id) on delete set null;

alter table video_projects
  add column if not exists variant_id uuid references variants(id) on delete set null;

alter table email_logs
  add column if not exists variant_id uuid references variants(id) on delete set null;

create index if not exists idx_blog_posts_variant_id on blog_posts(variant_id);
create index if not exists idx_carousels_variant_id on carousels(variant_id);
create index if not exists idx_video_projects_variant_id on video_projects(variant_id);
create index if not exists idx_email_logs_variant_id on email_logs(variant_id);
