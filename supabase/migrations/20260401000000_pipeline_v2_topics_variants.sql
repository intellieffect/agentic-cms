-- Pipeline v2: Topics and Variants

create table topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  keywords text[] default '{}',
  intent text default 'educate' check (intent in ('educate', 'inspire', 'convert', 'engage')),
  description text,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table variants (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references contents(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'linkedin', 'threads', 'tiktok', 'youtube', 'x')),
  format text not null check (format in ('reel', 'carousel', 'single_post', 'article', 'thread', 'story', 'short')),
  body_text text,
  hashtags text[] default '{}',
  character_count integer,
  platform_settings jsonb default '{}',
  status text default 'draft' check (status in ('draft', 'ready', 'sent_to_postiz', 'published')),
  actor_type text default 'agent' check (actor_type in ('agent', 'human')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table ideas
  add column if not exists topic_id uuid references topics(id),
  add column if not exists angle text,
  add column if not exists target_audience text;

alter table contents
  add column if not exists topic_id uuid references topics(id),
  add column if not exists content_type text default 'long_text' check (content_type in ('long_text', 'short_text', 'script', 'thread'));

alter table publications
  add column if not exists variant_id uuid references variants(id),
  add column if not exists postiz_post_id text;

create index idx_variants_content_id on variants(content_id);
create index idx_ideas_topic_id on ideas(topic_id);
create index idx_contents_topic_id on contents(topic_id);
