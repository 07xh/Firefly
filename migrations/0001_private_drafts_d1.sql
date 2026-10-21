-- Apply manually to a dedicated, private Cloudflare D1 database.
-- Do not run a production backend switch until all KV drafts are copied,
-- verified against R2 copies and approved for migration.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS private_drafts (
  slug TEXT PRIMARY KEY NOT NULL,
  version TEXT NOT NULL,
  record TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  extension TEXT NOT NULL CHECK(extension IN ('md', 'mdx'))
);

CREATE TABLE IF NOT EXISTS private_draft_revisions (
  slug TEXT NOT NULL,
  version TEXT NOT NULL,
  record TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  extension TEXT NOT NULL CHECK(extension IN ('md', 'mdx')),
  PRIMARY KEY (slug, version)
);

CREATE INDEX IF NOT EXISTS idx_private_draft_revisions_slug_updated
  ON private_draft_revisions(slug, updated_at DESC);
