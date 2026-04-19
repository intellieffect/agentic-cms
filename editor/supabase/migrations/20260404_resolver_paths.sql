CREATE TABLE IF NOT EXISTS file_paths (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  bucket TEXT DEFAULT 'media',
  file_size BIGINT,
  content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(filename)
);
CREATE INDEX IF NOT EXISTS idx_file_paths_filename ON file_paths(filename);
