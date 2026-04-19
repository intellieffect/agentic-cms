-- brxce-editor initial schema
-- Run against a fresh Supabase project

-- ─── Projects ───
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  orientation varchar(20) default 'vertical',
  status text default 'draft' check (status in ('draft','published','archived')),
  project_data jsonb not null default '{}',
  thumbnail_url text,
  duration float,
  clip_count int default 0,
  source_files jsonb,
  workspace_id text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_projects_status on projects (status) where deleted_at is null;
create index if not exists idx_projects_updated on projects (updated_at desc) where deleted_at is null;

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function update_updated_at();


-- ─── Presets ───
create table if not exists presets (
  id text primary key,
  name varchar(100) not null,
  description text,
  category varchar(50),
  config jsonb not null default '{}',
  is_system boolean default true,
  created_at timestamptz default now()
);


-- ─── Reference Accounts ───
create table if not exists reference_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text,
  platform text default 'instagram',
  avatar_url text,
  follower_count int,
  category text,
  bio text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_ref_accounts_platform on reference_accounts (platform);


-- ─── Reference Videos ───
create table if not exists reference_videos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references reference_accounts(id),
  platform text,
  post_date timestamptz,
  duration_sec float,
  like_count int default 0,
  comment_count int default 0,
  view_count int,
  caption text,
  url text,
  thumbnail_url text,
  video_url text,
  style_tags text[],
  transition_tags text[],
  music_tags text[],
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ref_videos_account on reference_videos (account_id);
create index if not exists idx_ref_videos_style on reference_videos using gin (style_tags);

create trigger trg_ref_videos_updated_at
  before update on reference_videos
  for each row execute function update_updated_at();


-- ─── Render Jobs ───
create table if not exists render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  status text default 'queued' check (status in ('queued','rendering','done','failed')),
  output_url text,
  progress float default 0,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_render_jobs_project on render_jobs (project_id);
create index if not exists idx_render_jobs_status on render_jobs (status);


-- ─── Finished Videos (완료 영상) ───
create table if not exists finished_videos (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  project_id uuid references projects(id),
  file_path text,
  file_url text,
  thumbnail_path text,
  duration float,
  file_size bigint,
  width int,
  height int,
  tags text[],
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_finished_videos_created on finished_videos (created_at desc);
