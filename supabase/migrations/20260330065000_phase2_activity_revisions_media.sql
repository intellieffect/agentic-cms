-- Phase 2: Activity Logs, Revisions, Media, Content Relations

-- Activity Logs (audit trail — the "agentic" differentiator)
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('create', 'update', 'delete', 'publish', 'revert', 'promote')),
  collection text not null, -- 'contents', 'ideas', 'publications'
  item_id uuid not null,
  actor text, -- agent name or user id
  actor_type text default 'agent' check (actor_type in ('agent', 'human')),
  payload jsonb default '{}', -- what changed
  timestamp timestamptz default now()
);

-- Revisions (version history)
create table revisions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references contents(id) on delete cascade,
  version_number integer not null,
  data jsonb not null, -- full snapshot of content at this point
  delta jsonb, -- what changed from previous version
  created_by text, -- agent name or user id
  actor_type text default 'agent',
  created_at timestamptz default now()
);

-- Media (normalized from jsonb)
create table media (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  mime_type text,
  file_size integer,
  width integer,
  height integer,
  url text not null,
  storage_path text,
  alt_text text,
  caption text,
  created_by text,
  created_at timestamptz default now()
);

-- Content-Media relation
create table content_media (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references contents(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  role text default 'attachment', -- 'featured', 'attachment', 'og-image'
  sort_order integer default 0
);

-- Content Relations
create table content_relations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references contents(id) on delete cascade,
  target_id uuid references contents(id) on delete cascade,
  relation_type text default 'related' check (relation_type in ('related', 'series', 'parent-child')),
  sort_order integer default 0
);

-- Add scheduled_publish_at to contents
alter table contents add column if not exists scheduled_publish_at timestamptz;
