// Adapted from projects/yandecode/packages/core/src/persistence/migrations/0001-initial.ts
// and 0002-chunk-embeddings.ts: drops the sessions/events tables (out of scope
// for SENTINEL), keeps a single index name ('repository'), and extends
// `documents` with repository/application/source to match RagDocumentMetadata.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  repository TEXT NOT NULL,
  application TEXT,
  source TEXT NOT NULL DEFAULT 'code',
  language TEXT,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  git_commit TEXT,
  indexed_at TEXT NOT NULL,
  index_generation INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  vector_id INTEGER NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  symbol TEXT,
  identifiers TEXT NOT NULL DEFAULT '',
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding BLOB,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content, symbol, identifiers,
  content='chunks', content_rowid='rowid',
  tokenize="unicode61 tokenchars '_'"
);
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content, symbol, identifiers) VALUES (new.rowid, new.content, new.symbol, new.identifiers);
END;
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content, symbol, identifiers) VALUES ('delete', old.rowid, old.content, old.symbol, old.identifiers);
END;
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content, symbol, identifiers) VALUES ('delete', old.rowid, old.content, old.symbol, old.identifiers);
  INSERT INTO chunks_fts(rowid, content, symbol, identifiers) VALUES (new.rowid, new.content, new.symbol, new.identifiers);
END;

CREATE TABLE IF NOT EXISTS vector_index_meta (
  name TEXT PRIMARY KEY CHECK (name IN ('repository')),
  generation INTEGER NOT NULL,
  dimensions INTEGER NOT NULL,
  model_id TEXT NOT NULL,
  vector_count INTEGER NOT NULL,
  built_at TEXT NOT NULL,
  file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS index_dirty (
  path TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  marked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vector_id_seq (
  name TEXT PRIMARY KEY CHECK (name IN ('repository')),
  next_id INTEGER NOT NULL
);
INSERT OR IGNORE INTO vector_id_seq (name, next_id) VALUES ('repository', 1);
`;
