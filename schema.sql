CREATE TABLE IF NOT EXISTS albums (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  album_slug TEXT NOT NULL,
  object_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL,
  approved INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (album_slug) REFERENCES albums(slug)
);

CREATE INDEX IF NOT EXISTS idx_photos_album_uploaded
ON photos(album_slug, uploaded_at DESC);
