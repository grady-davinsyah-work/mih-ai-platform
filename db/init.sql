-- MVP MIH schema — idempotent. Dijalankan saat container db pertama kali naik.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id             BIGSERIAL PRIMARY KEY,
  filename       TEXT NOT NULL,
  file_type      TEXT NOT NULL,
  file_extension TEXT NOT NULL,
  sha256         TEXT NOT NULL UNIQUE,
  file_path      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  error_message  TEXT,
  chunk_count    INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id            BIGSERIAL PRIMARY KEY,
  document_id   BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  embedding     vector(1536),
  page_or_slide INT,
  section_title TEXT,
  chunk_index   INT NOT NULL,
  is_outdated   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  unit_kerja    TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'default',
  token_hash   TEXT NOT NULL UNIQUE,
  scope        TEXT NOT NULL DEFAULT 'internal-read',
  daily_limit  INT NOT NULL DEFAULT 100,
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id           BIGSERIAL PRIMARY KEY,
  token_id     BIGINT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL REFERENCES users(id),
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  cited_chunks JSONB NOT NULL DEFAULT '[]',
  model        TEXT,
  latency_ms   INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx      ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_document_id_idx    ON chunks (document_id);
CREATE INDEX IF NOT EXISTS chunks_is_outdated_idx    ON chunks (is_outdated);
CREATE INDEX IF NOT EXISTS usage_logs_token_created_idx ON usage_logs (token_id, created_at);
