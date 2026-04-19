-- Carousel projects table for brxce-editor
CREATE TABLE IF NOT EXISTS carousels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '새 캐러셀',
  template TEXT NOT NULL DEFAULT 'CardNews',
  data JSONB NOT NULL DEFAULT '{}',
  style_config JSONB NOT NULL DEFAULT '{}',
  width INTEGER NOT NULL DEFAULT 1080,
  height INTEGER NOT NULL DEFAULT 1350,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for listing
CREATE INDEX IF NOT EXISTS idx_carousels_updated_at ON carousels (updated_at DESC);

-- Reference collections table
CREATE TABLE IF NOT EXISTS reference_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: reference_videos <-> collections
CREATE TABLE IF NOT EXISTS reference_collection_items (
  collection_id TEXT NOT NULL REFERENCES reference_collections(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, video_id)
);

-- Image references (non-video)
CREATE TABLE IF NOT EXISTS reference_images (
  id TEXT PRIMARY KEY,
  url TEXT,
  local_path TEXT,
  caption TEXT,
  tags TEXT[] DEFAULT '{}',
  source_platform TEXT,
  source_url TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reference_images_created_at ON reference_images (created_at DESC);
