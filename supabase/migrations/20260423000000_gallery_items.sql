-- AWC Gallery — 전시물(gallery_items) + 미디어 연결(gallery_item_media)
-- Context: 4/23 회의 결정 t_8670eef. Web(랜딩+/my) + APP(DDD) Gallery 페어 신설.
-- - media는 저수준 자산 풀(blog 본문/캐러셀 슬라이드 공유)으로 유지
-- - gallery_items는 "Gallery 전시물" 추상 — 1 item이 여러 media 참조 가능(커버 + 추가)
-- - Phase 1 lifecycle: draft → published → featured(flag). review 상태는 Phase 2.

-- ── gallery_items: Gallery 전시물 ──
create table gallery_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  summary text,

  -- 분류
  kind text not null check (kind in (
    'landing', 'video', 'ad', 'image', 'carousel', 'case_study', 'other'
  )),

  -- 원본 추적 (nullable — 외부 합성물·수동 업로드 대비)
  source_table text,   -- 'blog_posts' | 'carousels' | 'social_posts' | 'video_projects' | null
  source_id uuid,

  -- 커버 미디어 (빠른 접근 캐시, 상세 표시는 gallery_item_media 사용)
  cover_media_id uuid references media(id) on delete set null,
  cover_aspect text default '16:9' check (cover_aspect in ('1:1', '16:9', '9:16', '4:5', '3:4')),

  -- lifecycle (Phase 1 — review 생략)
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  visibility text not null default 'public' check (visibility in ('internal', 'member', 'public')),

  -- 큐레이션
  is_featured boolean default false,
  featured_rank integer,

  -- 시간
  published_at timestamptz,
  featured_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- 메타
  tags text[] default '{}',
  brand text default 'awc',
  author text,
  duration_minutes integer,
  source_label text default 'Agentic CMS',

  -- 메트릭 미러 (Phase 3 auto-curation 판단용)
  metrics jsonb default '{}'
);

-- ── gallery_item_media: 1 item → N media 순서 ──
create table gallery_item_media (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references gallery_items(id) on delete cascade,
  media_id uuid references media(id) on delete restrict,
  role text default 'gallery' check (role in ('cover', 'gallery', 'detail', 'hero_video')),
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- ── 인덱스 ──
create index idx_gallery_items_status on gallery_items(status, visibility);
create index idx_gallery_items_featured on gallery_items(is_featured, featured_rank)
  where is_featured = true;
create index idx_gallery_items_kind on gallery_items(kind);
create index idx_gallery_items_published_at on gallery_items(published_at desc);
create index idx_gallery_items_tags on gallery_items using gin(tags);
create index idx_gallery_item_media_item on gallery_item_media(item_id, sort_order);

-- ── updated_at 자동 갱신 트리거 ──
create or replace function fn_gallery_items_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_gallery_items_updated_at
  before update on gallery_items
  for each row execute function fn_gallery_items_touch_updated_at();

-- ── RLS ──
alter table gallery_items enable row level security;
alter table gallery_item_media enable row level security;

-- anon: published + public 만 읽기
create policy "anon read public gallery_items"
  on gallery_items for select to anon
  using (status = 'published' and visibility = 'public');

create policy "anon read gallery_item_media of public items"
  on gallery_item_media for select to anon
  using (
    item_id in (
      select id from gallery_items
      where status = 'published' and visibility = 'public'
    )
  );

-- authenticated: member 이상까지 읽기 (member·public)
create policy "auth read member+public gallery_items"
  on gallery_items for select to authenticated
  using (status = 'published' and visibility in ('member', 'public'));

create policy "auth read gallery_item_media of member+public items"
  on gallery_item_media for select to authenticated
  using (
    item_id in (
      select id from gallery_items
      where status = 'published' and visibility in ('member', 'public')
    )
  );

-- service_role: 전체 관리 (bypass by default — 명시 정책은 생략)
