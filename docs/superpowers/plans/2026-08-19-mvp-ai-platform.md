# MVP Platform AI Internal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a token-gated RAG Q&A platform over public deputation documents (PPTX/PDF/DOCX) with ingestion, PostgreSQL+pgvector, a Bun+Express API, a Python ingestion worker, and a React dashboard, all runnable via `docker compose up`.

**Architecture:** A monorepo with four parts sharing one PostgreSQL+pgvector database. The Python worker parses files into structurally chunked segments with source metadata, embeds them via OpenAI, and writes chunks directly to Postgres. The Bun+Express backend validates API tokens (sha256-hashed, scoped, rate-limited), does pgvector similarity search, generates answers with citations via GPT-4o-mini, and logs every request. The React frontend (served by nginx, proxying `/api` to the backend) provides login, admin, documents, and playground pages.

**Tech Stack:** Bun + Express (backend) · React Vite + Tailwind CSS (frontend) · PostgreSQL + pgvector (`pgvector/pgvector:pg16`) · Python 3.12 + python-pptx/pypdf/python-docx/psycopg3/openai/tiktoken (worker) · Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-19-mvp-ai-platform-design.md`

## Global Constraints

- PostgreSQL via `pgvector/pgvector:pg16` only. Embedding dimension fixed at **1536** (`text-embedding-3-small`).
- Environment variable names exactly as in `.env.example` (`DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o-mini`, `EMBEDDING_MODEL=text-embedding-3-small`, `EMBEDDING_DIM=1536`, `SESSION_SECRET`, `PORT=3000`, `DATA_DIR=/data`, `INGEST_INTERVAL_SEC=30`, `VECTOR_K=8`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- API token plaintext format: `mih_` + 32 random bytes (base64url). Stored hash: sha256 hex. Plaintext shown exactly once at generation.
- Chunk target **300–800 tokens**, overlap **~15%**. Every chunk carries source metadata (`document_id`, `page_or_slide`, `section_title`, `chunk_index`).
- Document status values: `pending` / `processing` / `completed` / `failed`. Revisions mark old chunks `is_outdated=true` (never delete).
- All timestamps `TIMESTAMPTZ`. Chinese/Indonesian answer language: Bahasa Indonesia, with `[n]` citation markers.
- Portal auth: email+password, scrypt-hashed, stateless HMAC-signed cookie (`mih_session`). Admin-only routes gated by `is_admin`.
- Supported file extensions: `pptx`, `pdf`, `docx` only. `file_type` auto-classified: pptx→`paparan`, pdf/docx→`laporan`, else `lainnya`.
- Ports: backend `3000` (container-internal), frontend `8080:80` (public), db `5432` (host dev), db-internal `5432`.
- Each task ends with a git commit.

---

## Task 1: Database schema + verification container

**Files:**
- Create: `db/init.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `documents`, `chunks`, `users`, `api_tokens`, `usage_logs`; pgvector index on `chunks.embedding`. All later tasks query these exact tables/columns.

- [ ] **Step 1: Write the schema**

Create `db/init.sql`:

```sql
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
```

- [ ] **Step 2: Verify the schema on a throwaway pgvector container**

```bash
docker run --rm -d --name mih-db-check \
  -e POSTGRES_PASSWORD=mih \
  -v "$PWD/db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro" \
  -p 5433:5432 pgvector/pgvector:pg16
sleep 6
docker exec mih-db-check psql -U postgres -c '\dt'
```
Expected: five tables listed (`documents`, `chunks`, `users`, `api_tokens`, `usage_logs`).

Verify re-run is idempotent (no errors):
```bash
docker exec mih-db-check psql -U postgres -f /docker-entrypoint-initdb.d/init.sql
docker rm -f mih-db-check
```

- [ ] **Step 3: Commit**

```bash
git add db/init.sql
git commit -m "feat(db): add idempotent schema with pgvector"
```

---

## Task 2: Worker scaffolding (segment model, DB access, embeddings client)

**Files:**
- Create: `worker/requirements.txt`
- Create: `worker/parsers/__init__.py`, `worker/parsers/base.py`
- Create: `worker/db.py`
- Create: `worker/embedding.py`
- Create: `worker/tests/test_smoke.py`

**Interfaces:**
- Consumes: `db/init.sql` schema (Task 1).
- Produces: `parsers.Segment` dataclass; `db.connect()`, `db.ensure_raw_document(...)`, `db.get_pending(...)`, `db.set_status(...)`, `db.complete_document(...)`, `db.insert_chunk(...)`, `db.mark_outdated_same_filename(...)`, `db.file_path_ext(...)`, `db.SUPPORTED_EXTENSIONS`; `embedding.embed_texts(texts: list[str]) -> list[list[float]]`.

- [ ] **Step 1: Write `worker/requirements.txt`**

```
python-pptx>=1.0.0
python-docx>=1.1.0
pypdf>=5.0.0
reportlab>=4.0.0
openai>=1.40.0
psycopg[binary]>=3.2.0
tiktoken>=0.7.0
pytest>=8.0.0
```

- [ ] **Step 2: Write the segment model** — `worker/parsers/base.py`:

```python
from dataclasses import dataclass


@dataclass
class Segment:
    text: str
    page_or_slide: int | None = None
    section_title: str | None = None
    needs_ocr: bool = False
```

- [ ] **Step 3: Write `worker/parsers/__init__.py`**:

```python
from .base import Segment
from .pptx import parse_pptx
from .pdf import parse_pdf
from .docx import parse_docx


def parse_document(path, extension):
    ext = extension.lower().lstrip(".")
    if ext == "pptx":
        return parse_pptx(path)
    if ext == "pdf":
        return parse_pdf(path)
    if ext == "docx":
        return parse_docx(path)
    raise ValueError(f"ekstensi tidak didukung: {extension}")
```

- [ ] **Step 4: Write `worker/db.py`**:

```python
import json
import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

SUPPORTED_EXTENSIONS = {"pptx", "pdf", "docx"}


def connect():
    return psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)


def file_path_ext(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")


def ensure_raw_document(conn, filename: str, file_path: str, sha256: str, file_type: str) -> bool:
    """Insert dokumen pending jika hash belum ada. Return True jika baru."""
    if file_path_ext(filename) not in SUPPORTED_EXTENSIONS:
        return False
    exists = conn.execute("SELECT 1 FROM documents WHERE sha256=%s", (sha256,)).fetchone()
    if exists:
        return False
    conn.execute(
        "INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status) "
        "VALUES (%s, %s, %s, %s, %s, 'pending')",
        (filename, file_type, file_path_ext(filename), sha256, file_path),
    )
    return True


def get_pending(conn, limit: int = 10):
    return conn.execute(
        "SELECT id, filename, file_type, file_extension, file_path FROM documents "
        "WHERE status='pending' ORDER BY id LIMIT %s",
        (limit,),
    ).fetchall()


def set_status(conn, doc_id: int, status: str, error_message: str | None = None):
    conn.execute(
        "UPDATE documents SET status=%s, error_message=%s, updated_at=now() WHERE id=%s",
        (status, error_message, doc_id),
    )


def complete_document(conn, doc_id: int, chunk_count: int, warning: str | None = None):
    conn.execute(
        "UPDATE documents SET status='completed', chunk_count=%s, error_message=%s, updated_at=now() WHERE id=%s",
        (chunk_count, warning, doc_id),
    )


def insert_chunk(conn, doc_id: int, chunk, embedding):
    conn.execute(
        "INSERT INTO chunks (document_id, content, embedding, page_or_slide, section_title, chunk_index) "
        "VALUES (%s, %s, %s::vector, %s, %s, %s)",
        (doc_id, chunk.text, json.dumps(embedding), chunk.page_or_slide, chunk.section_title, chunk.chunk_index),
    )


def mark_outdated_same_filename(conn, filename: str, except_doc_id: int):
    conn.execute(
        "UPDATE chunks SET is_outdated=TRUE WHERE document_id IN "
        "(SELECT id FROM documents WHERE filename=%s AND id<>%s AND status='completed')",
        (filename, except_doc_id),
    )
```

- [ ] **Step 5: Write `worker/embedding.py`**:

```python
import os

from openai import OpenAI

MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
BATCH = 64


def embed_texts(texts: list[str]) -> list[list[float]]:
    client = OpenAI()
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        resp = client.embeddings.create(model=MODEL, input=batch)
        out.extend([d.embedding for d in resp.data])
    return out
```

- [ ] **Step 6: Write the failing smoke-import test** — `worker/tests/test_smoke.py`:

```python
def test_imports_and_constants():
    from parsers import Segment
    from db import connect, SUPPORTED_EXTENSIONS
    from embedding import embed_texts
    from chunking import chunk_segments, token_count

    assert "pptx" in SUPPORTED_EXTENSIONS
    assert "pdf" in SUPPORTED_EXTENSIONS
    assert "docx" in SUPPORTED_EXTENSIONS
    assert callable(embed_texts)
    assert callable(connect)
    assert callable(chunk_segments)
    assert callable(token_count)
    s = Segment(text="halo")
    assert s.page_or_slide is None
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd worker && python -m pytest tests/test_smoke.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'chunking'` (dibuat di Task 4).

- [ ] **Step 8: Install dependencies**

```bash
cd worker && python -m pip install -r requirements.txt
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd worker && python -m pytest tests/test_smoke.py -v`
Expected: PASS (setelah `chunking` dibuat di Task 4; jika masih gagal, buat `worker/chunking.py` berisi stub `def chunk_segments(...): return []` dan `def token_count(t): return max(1, len(t)//4)` untuk sementara).

- [ ] **Step 10: Commit**

```bash
git add worker
git commit -m "feat(worker): scaffold segment model, db access, embeddings client"
```

---

## Task 3: Parsers (PPTX / PDF / DOCX)

**Files:**
- Create: `worker/parsers/pptx.py`, `worker/parsers/pdf.py`, `worker/parsers/docx.py`
- Create: `worker/tests/test_parsers.py`

**Interfaces:**
- Consumes: `parsers.Segment` (Task 2).
- Produces: `parse_pptx(path) -> list[Segment]`, `parse_pdf(path) -> list[Segment]`, `parse_docx(path) -> list[Segment]`.

- [ ] **Step 1: Write the failing tests** — `worker/tests/test_parsers.py`:

```python
from pptx import Presentation
from docx import Document
from reportlab.pdfgen import canvas

from parsers import parse_pptx, parse_pdf, parse_docx


def make_pptx(path):
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = "Judul Slide 1"
    body = slide.placeholders[1].text_frame
    body.text = "Isi paparan slide pertama."
    slide.notes_slide.notes_text_frame.text = "Catatan pembicara di sini."
    prs.save(path)


def make_pdf(path):
    c = canvas.Canvas(str(path))
    c.drawString(72, 700, "Halaman satu dari laporan.")
    c.showPage()
    c.drawString(72, 700, "Halaman dua dari laporan.")
    c.save()


def make_pdf_blank(path):
    c = canvas.Canvas(str(path))
    c.showPage()
    c.save()


def make_docx(path):
    doc = Document()
    doc.add_heading("Pendahuluan", level=1)
    doc.add_paragraph("Paragraf pembuka laporan.")
    doc.add_heading("Metodologi", level=1)
    doc.add_paragraph("Penjelasan metodologi.")
    doc.save(path)


def test_parse_pptx_slides_and_notes(tmp_path):
    p = tmp_path / "d.pptx"
    make_pptx(p)
    segs = parse_pptx(p)
    assert len(segs) == 1
    assert segs[0].page_or_slide == 1
    assert "Isi paparan" in segs[0].text
    assert "Catatan pembicara" in segs[0].text


def test_parse_pdf_text_per_page(tmp_path):
    p = tmp_path / "a.pdf"
    make_pdf(p)
    segs = parse_pdf(p)
    assert len(segs) == 2
    assert segs[0].page_or_slide == 1
    assert "Halaman satu" in segs[0].text
    assert segs[0].needs_ocr is False


def test_parse_pdf_blank_flags_ocr(tmp_path):
    p = tmp_path / "b.pdf"
    make_pdf_blank(p)
    segs = parse_pdf(p)
    assert segs[0].needs_ocr is True


def test_parse_docx_grouped_by_heading(tmp_path):
    p = tmp_path / "c.docx"
    make_docx(p)
    segs = parse_docx(p)
    assert len(segs) == 2
    assert segs[0].section_title == "Pendahuluan"
    assert "Paragraf pembuka" in segs[0].text
    assert segs[1].section_title == "Metodologi"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && python -m pytest tests/test_parsers.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'parsers.pptx'`.

- [ ] **Step 3: Write `worker/parsers/pptx.py`**:

```python
from pathlib import Path

from .base import Segment


def _first_line(text: str) -> str | None:
    line = next((ln.strip() for ln in text.splitlines() if ln.strip()), None)
    return line or None


def parse_pptx(path: Path) -> list[Segment]:
    from pptx import Presentation

    prs = Presentation(str(path))
    segments: list[Segment] = []
    for i, slide in enumerate(prs.slides, start=1):
        texts: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                t = shape.text_frame.text.strip()
                if t:
                    texts.append(t)
            elif shape.has_table:
                for row in shape.table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells)
                    if row_text.strip(" |"):
                        texts.append(row_text)
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                texts.append(f"[Catatan pembicara] {notes}")
        text = "\n".join(texts).strip()
        if text:
            segments.append(
                Segment(text=text, page_or_slide=i, section_title=_first_line(text))
            )
    return segments
```

- [ ] **Step 4: Write `worker/parsers/pdf.py`**:

```python
from pathlib import Path

from .base import Segment


def parse_pdf(path: Path) -> list[Segment]:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    segments: list[Segment] = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            segments.append(Segment(text=text, page_or_slide=i, needs_ocr=False))
        else:
            segments.append(Segment(text="", page_or_slide=i, needs_ocr=True))
    return segments
```

- [ ] **Step 5: Write `worker/parsers/docx.py`**:

```python
from pathlib import Path

from .base import Segment


def parse_docx(path: Path) -> list[Segment]:
    from docx import Document

    doc = Document(str(path))
    segments: list[Segment] = []
    current_heading: str | None = None
    buffer: list[str] = []

    def flush():
        nonlocal buffer
        text = "\n".join(buffer).strip()
        if text:
            segments.append(Segment(text=text, page_or_slide=None, section_title=current_heading))
        buffer = []

    for para in doc.paragraphs:
        style = para.style.name if para.style else ""
        text = para.text.strip()
        if not text:
            continue
        if style == "Title" or style.startswith("Heading"):
            flush()
            current_heading = text
        else:
            buffer.append(text)
    flush()
    return segments
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd worker && python -m pytest tests/test_parsers.py -v`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add worker
git commit -m "feat(worker): add pptx/pdf/docx parsers"
```

---

## Task 4: Structural chunking

**Files:**
- Create: `worker/chunking.py`
- Create: `worker/tests/test_chunking.py`

**Interfaces:**
- Consumes: `parsers.Segment` (Task 2).
- Produces: `chunking.Chunk` dataclass; `token_count(text) -> int`; `token_tail(text, ratio) -> str`; `split_sentences(text) -> list[str]`; `chunk_segments(segments, *, min_tokens=300, max_tokens=800, overlap_ratio=0.15) -> list[Chunk]`.

- [ ] **Step 1: Write the failing tests** — `worker/tests/test_chunking.py`:

```python
from chunking import chunk_segments, token_count, split_sentences, token_tail
from parsers import Segment


def test_split_sentences_basic():
    text = "Kalimat pertama. Kalimat kedua! Kalimat ketiga?"
    assert split_sentences(text) == ["Kalimat pertama.", "Kalimat kedua!", "Kalimat ketiga?"]


def test_chunk_size_within_max():
    seg = Segment(text=" ".join(["Ini adalah kalimat pengisi untuk menguji chunking dokumen kedeputian."] * 200),
                  page_or_slide=1, section_title="Bab 1")
    chunks = chunk_segments([seg])
    assert chunks, "harus menghasilkan minimal satu chunk"
    for c in chunks:
        assert token_count(c.text) <= 800, f"chunk {c.chunk_index} melebihi 800 token"


def test_chunk_metadata_present():
    seg = Segment(text=" ".join(["Kata kata pengisi untuk menguji metadata chunk."] * 80),
                  page_or_slide=3, section_title="Sub-bab A")
    chunks = chunk_segments([seg])
    assert len(chunks) >= 1
    for c in chunks:
        assert c.page_or_slide == 3
        assert c.section_title == "Sub-bab A"


def test_overlap_between_consecutive_chunks():
    seg = Segment(text=" ".join(["Kata kata pengisi yang cukup panjang agar terpecah menjadi beberapa chunk."] * 150),
                  page_or_slide=1, section_title="x")
    chunks = chunk_segments([seg])
    assert len(chunks) >= 2
    for a, b in zip(chunks, chunks[1:]):
        tail = token_tail(a.text, 0.15)
        assert tail in b.text, "overlap antar chunk tidak ditemukan"


def test_chunk_indices_sequential():
    seg = Segment(text=" ".join(["Kata kata pengisi untuk urutan chunk."] * 120),
                  page_or_slide=2, section_title="y")
    chunks = chunk_segments([seg])
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && python -m pytest tests/test_chunking.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'chunking'`.

- [ ] **Step 3: Write `worker/chunking.py`**:

```python
import re
from dataclasses import dataclass

import tiktoken

from parsers import Segment

_ENC = tiktoken.get_encoding("cl100k_base")
_SENT_SPLIT = re.compile(r"(?<=[.!?。！？])\s+|(?<=\n)\s*")


@dataclass
class Chunk:
    text: str
    page_or_slide: int | None
    section_title: str | None
    chunk_index: int


def token_count(text: str) -> int:
    try:
        return len(_ENC.encode(text))
    except Exception:
        # fallback deterministik tanpa jaringan
        return max(1, len(text) // 4)


def token_tail(text: str, ratio: float = 0.15) -> str:
    toks = _ENC.encode(text)
    n = max(1, int(len(toks) * ratio))
    return _ENC.decode(toks[-n:])


def split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in _SENT_SPLIT.split(text) if p.strip()]
    return parts or ([text] if text.strip() else [])


def chunk_segments(segments: list[Segment], *, min_tokens: int = 300,
                   max_tokens: int = 800, overlap_ratio: float = 0.15) -> list[Chunk]:
    chunks: list[Chunk] = []
    idx = 0
    for seg in segments:
        tail = ""
        buffer = ""
        for sent in split_sentences(seg.text):
            if buffer:
                candidate = f"{tail} {buffer} {sent}".strip() if tail else f"{buffer} {sent}".strip()
            else:
                candidate = f"{tail} {sent}".strip() if tail else sent
            if token_count(candidate) <= max_tokens:
                buffer = candidate
                continue
            if buffer:
                chunks.append(Chunk(text=buffer, page_or_slide=seg.page_or_slide,
                                    section_title=seg.section_title, chunk_index=idx))
                idx += 1
                tail = token_tail(buffer, overlap_ratio)
                buffer = ""
            cand2 = f"{tail} {sent}".strip() if tail else sent
            if token_count(cand2) <= max_tokens:
                buffer = cand2
                tail = ""
            else:
                # kalimat tunggal melebihi batas → simpan apa adanya
                chunks.append(Chunk(text=cand2, page_or_slide=seg.page_or_slide,
                                    section_title=seg.section_title, chunk_index=idx))
                idx += 1
                tail = ""
                buffer = ""
        if buffer:
            chunks.append(Chunk(text=buffer, page_or_slide=seg.page_or_slide,
                                section_title=seg.section_title, chunk_index=idx))
            idx += 1
    return chunks
```

Catatan: `min_tokens` disengaja longgar — segmen pendek boleh menghasilkan chunk kecil; batas `max_tokens` bersifat keras.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && python -m pytest tests/test_chunking.py -v`
Expected: PASS (5 tests). Jika test `chunk_size_within_max` gagal karena satu kalimat > 800 token, cek kembali pengulangan kalimat (harusnya tiap kalimat pendek).

- [ ] **Step 5: Commit**

```bash
git add worker/chunking.py worker/tests/test_chunking.py
git commit -m "feat(worker): structural chunking with overlap"
```

---

## Task 5: Ingestion orchestration (scan / watch / process)

**Files:**
- Create: `worker/ingest.py`
- Create: `worker/tests/test_ingest.py`

**Interfaces:**
- Consumes: `db.*` (Task 2), `parsers.parse_document` (Task 3), `chunking.chunk_segments` (Task 4), `embedding.embed_texts` (Task 2).
- Produces: CLI `ingest.py` with subcommands `scan --dir` and `watch`; functions `sha256_file(path)`, `classify_file(filename)`, `scan_dir(conn, dirpath)`, `process_document(conn, doc)`, `process_pending(conn, limit=10)`.

- [ ] **Step 1: Write the failing tests** — `worker/tests/test_ingest.py`:

```python
import hashlib

from ingest import classify_file, sha256_file
from db import file_path_ext, SUPPORTED_EXTENSIONS


def test_classify_file():
    assert classify_file("paparan-rencana.pptx") == "paparan"
    assert classify_file("laporan-makro.pdf") == "laporan"
    assert classify_file("laporan-makro.docx") == "laporan"
    assert classify_file("data.csv") == "lainnya"


def test_sha256_file(tmp_path):
    p = tmp_path / "x.bin"
    p.write_bytes(b"hello world")
    expected = hashlib.sha256(b"hello world").hexdigest()
    assert sha256_file(p) == expected


def test_file_path_ext_and_supported():
    assert file_path_ext("a.PPTX") == "pptx"
    assert file_path_ext("b.pdf") == "pdf"
    assert SUPPORTED_EXTENSIONS == {"pptx", "pdf", "docx"}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && python -m pytest tests/test_ingest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'ingest'`.

- [ ] **Step 3: Write `worker/ingest.py`**:

```python
import argparse
import hashlib
import os
import time
from pathlib import Path

from chunking import chunk_segments
from db import (connect, complete_document, ensure_raw_document, get_pending,
                insert_chunk, mark_outdated_same_filename, set_status,
                file_path_ext, SUPPORTED_EXTENSIONS)
from embedding import embed_texts
from parsers import parse_document


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            h.update(block)
    return h.hexdigest()


def classify_file(filename: str) -> str:
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext == "pptx":
        return "paparan"
    if ext in ("pdf", "docx"):
        return "laporan"
    return "lainnya"


def scan_dir(conn, dirpath: str) -> int:
    added = 0
    for path in sorted(Path(dirpath).rglob("*")):
        if not path.is_file():
            continue
        if file_path_ext(path.name) not in SUPPORTED_EXTENSIONS:
            continue
        sha = sha256_file(path)
        if ensure_raw_document(conn, path.name, str(path), sha, classify_file(path.name)):
            added += 1
    return added


def process_document(conn, doc) -> int:
    doc_id = doc["id"]
    set_status(conn, doc_id, "processing")
    path = Path(doc["file_path"])
    if not path.exists():
        raise FileNotFoundError(f"file tidak ditemukan: {path}")
    segments = parse_document(path, doc["file_extension"])
    ocr_pages = [s.page_or_slide for s in segments if s.needs_ocr]
    chunks = chunk_segments(segments)
    if not chunks:
        raise ValueError("tidak ada teks terekstrak — kemungkinan hasil scan, perlu OCR")
    vectors = embed_texts([c.text for c in chunks])
    for c, v in zip(chunks, vectors):
        insert_chunk(conn, doc_id, c, v)
    mark_outdated_same_filename(conn, doc["filename"], doc_id)
    warning = f"perlu OCR pada halaman {ocr_pages}" if ocr_pages else None
    complete_document(conn, doc_id, len(chunks), warning)
    return len(chunks)


def process_pending(conn, limit: int = 10) -> int:
    done = 0
    for doc in get_pending(conn, limit):
        try:
            n = process_document(conn, doc)
            print(f"ok doc={doc['id']} chunks={n} file={doc['filename']}")
            done += 1
        except Exception as e:
            set_status(conn, doc["id"], "failed", str(e))
            print(f"fail doc={doc['id']} err={e}")
    return done


def watch():
    conn = connect()
    raw_dir = os.environ.get("RAW_DIR", "/data/raw")
    interval = int(os.environ.get("INGEST_INTERVAL_SEC", "30"))
    Path(raw_dir).mkdir(parents=True, exist_ok=True)
    print(f"watch aktif: {raw_dir} setiap {interval}s")
    while True:
        try:
            added = scan_dir(conn, raw_dir)
            if added:
                print(f"scan: {added} dokumen baru diantrekan")
            process_pending(conn)
        except Exception as e:
            print("watch error:", e)
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(prog="ingest")
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("scan")
    s.add_argument("--dir", default="/data/raw")
    sub.add_parser("watch")
    args = parser.parse_args()

    conn = connect()
    if args.cmd == "scan":
        n = scan_dir(conn, args.dir)
        process_pending(conn)
        print(f"siap: {n} dokumen baru diantrekan")
    elif args.cmd == "watch":
        watch()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && python -m pytest tests/ -v`
Expected: PASS (test_smoke, test_parsers, test_chunking, test_ingest semuanya hijau).

- [ ] **Step 5: Commit**

```bash
git add worker
git commit -m "feat(worker): ingestion CLI scan/watch with dedup and status"
```

---

## Task 6: Backend scaffold (Bun + Express + app + health) + dev DB

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/src/config.ts`, `backend/src/db.ts`, `backend/src/types.ts`, `backend/src/app.ts`, `backend/src/index.ts`, `backend/tests/setup.ts`, `backend/tests/helpers.ts`, `backend/tests/health.test.ts`
- Create: `scripts/dev-db.sh`

**Interfaces:**
- Consumes: `db/init.sql` (Task 1).
- Produces: `createApp()` (Express app, mount `loadSession`, `/api` routes, `/health`); `config` object (all env); `pool` (pg Pool). Later tasks add route files under `src/routes/` and mount them in `src/app.ts`.

- [ ] **Step 1: Write `backend/package.json`**:

```json
{
  "name": "mih-backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test --preload ./tests/setup.ts",
    "seed": "bun run scripts/seed.ts"
  },
  "dependencies": {
    "express": "^5.1.0",
    "multer": "^1.4.5-lts.1",
    "openai": "^4.67.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/bun": "^1.1.0",
    "@types/express": "^5.0.0",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.7.0",
    "@types/pg": "^8.11.10",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Write `backend/tsconfig.json`**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node", "bun"],
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src", "tests", "scripts"]
}
```

- [ ] **Step 3: Write `backend/src/config.ts`**:

```ts
export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://mih:mih@localhost:5432/mih",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1536),
  sessionSecret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
  port: Number(process.env.PORT ?? 3000),
  dataDir: process.env.DATA_DIR ?? "/data",
  vectorK: Number(process.env.VECTOR_K ?? 8),
  llmProvider: process.env.LLM_PROVIDER ?? "openai", // "openai" | "mock"
};
```

- [ ] **Step 4: Write `backend/src/db.ts`**:

```ts
import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({ connectionString: config.databaseUrl });
```

- [ ] **Step 5: Write `backend/src/types.ts`** (augmentasi Express Request):

```ts
declare global {
  namespace Express {
    interface Request {
      auth?: { tokenId: number; userId: number; scope: string };
      session?: Record<string, any>;
    }
  }
}

export {};
```

- [ ] **Step 6: Write `backend/src/app.ts`**:

```ts
import express, { type NextFunction, type Request, type Response } from "express";
import { loadSession } from "./middleware/sessionAuth";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(loadSession);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  // Express 5 meneruskan error dari handler async ke middleware berikut
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });
  return app;
}
```

- [ ] **Step 7: Write `backend/src/index.ts`**:

```ts
import { config } from "./config";
import { createApp } from "./app";

const app = createApp();
app.listen(config.port, () => console.log(`backend listening on :${config.port}`));
```

- [ ] **Step 8: Write the failing test** — `backend/tests/health.test.ts`:

```ts
import { test, expect } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

test("GET /health returns ok", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});
```

`src/middleware/sessionAuth.ts` belum ada — tulislah stub berikut agar test ini lulus (akan dilengkapi di Task 9):

```ts
import type { Request, Response, NextFunction } from "express";

export function loadSession(_req: Request, _res: Response, next: NextFunction) {
  next();
}
```

- [ ] **Step 9: Write test harness** — `backend/tests/setup.ts`:

```ts
process.env.LLM_PROVIDER ??= "mock";
process.env.SESSION_SECRET ??= "test-secret";
process.env.TEST_DATABASE_URL ??= "postgres://mih:mih@localhost:5432/mih_test";
process.env.DATA_DIR ??= ".test-data";
```

`backend/tests/helpers.ts`:

```ts
import { readFileSync } from "node:fs";
import { Pool } from "pg";

export const testDb = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ?? "postgres://mih:mih@localhost:5432/mih_test",
});

export async function applySchema() {
  const sql = readFileSync(new URL("../../db/init.sql", import.meta.url), "utf8");
  await testDb.query(sql);
}

export async function truncateAll() {
  await testDb.query(
    "TRUNCATE usage_logs, api_tokens, chunks, documents, users RESTART IDENTITY CASCADE"
  );
}
```

- [ ] **Step 10: Start dev DB & run test**

```bash
bash scripts/dev-db.sh   # lihat bawah
cd backend && bun install && bun test
```
Expected: 1 test PASS.

`scripts/dev-db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
# Menjalankan pgvector untuk development & test di host (port 5432).
if ! docker ps -a --format '{{.Names}}' | grep -q '^mih-dev-db$'; then
  docker run --name mih-dev-db -e POSTGRES_USER=mih -e POSTGRES_PASSWORD=mih \
    -d -p 5432:5432 pgvector/pgvector:pg16
fi
until docker exec mih-dev-db pg_isready -U mih >/dev/null 2>&1; do sleep 1; done
docker exec mih-dev-db psql -U mih -tAc "SELECT 1 FROM pg_database WHERE datname='mih_test'" \
  | grep -q 1 || docker exec mih-dev-db createdb -U mih mih_test
echo "db siap: mih@localhost:5432/mih (app) dan /mih_test (tests)"
```

- [ ] **Step 11: Commit**

```bash
chmod +x scripts/dev-db.sh
git add backend scripts/dev-db.sh
git commit -m "feat(backend): scaffold bun+express app with health endpoint"
```

---

## Task 7: Token library + API token auth middleware + rate limit

**Files:**
- Create: `backend/src/lib/token.ts`, `backend/src/lib/passwords.ts`, `backend/src/lib/rateLimit.ts`, `backend/src/middleware/tokenAuth.ts`
- Create: `backend/tests/token.test.ts`, `backend/tests/integration.auth.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 6).
- Produces: `generateToken() -> string`, `hashToken(token) -> string`; `hashPassword(pw) -> string`, `verifyPassword(pw, stored) -> boolean`; `getTodayUsage(tokenId) -> Promise<number>`; middleware `tokenAuth` (attaches `req.auth = { tokenId, userId, scope }`, responds 401/403/429).

- [ ] **Step 1: Write the failing unit tests** — `backend/tests/token.test.ts`:

```ts
import { test, expect } from "bun:test";
import { generateToken, hashToken } from "../src/lib/token";
import { hashPassword, verifyPassword } from "../src/lib/passwords";

test("generateToken produces mih_ prefixed tokens", () => {
  const t = generateToken();
  expect(t.startsWith("mih_")).toBe(true);
  expect(t.length).toBeGreaterThan("mih_".length + 20);
});

test("hashToken is deterministic sha256", () => {
  expect(hashToken("abc")).toBe(hashToken("abc"));
  expect(hashToken("abc")).not.toBe(hashToken("abd"));
});

test("password hash round-trips and rejects wrong password", () => {
  const stored = hashPassword("rahasia123");
  expect(verifyPassword("rahasia123", stored)).toBe(true);
  expect(verifyPassword("salah", stored)).toBe(false);
  expect(stored).not.toContain("rahasia123");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && bun test tests/token.test.ts`
Expected: FAIL — module not found `../src/lib/token`.

- [ ] **Step 3: Write `backend/src/lib/token.ts`**:

```ts
import { createHash, randomBytes } from "node:crypto";

export function generateToken(): string {
  return "mih_" + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

- [ ] **Step 4: Write `backend/src/lib/passwords.ts`**:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}
```

- [ ] **Step 5: Write `backend/src/lib/rateLimit.ts`**:

```ts
import { pool } from "../db";

export async function getTodayUsage(tokenId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM usage_logs
      WHERE token_id = $1 AND created_at >= date_trunc('day', now())`,
    [tokenId]
  );
  return rows[0].n;
}
```

- [ ] **Step 6: Write `backend/src/middleware/tokenAuth.ts`**:

```ts
import type { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { hashToken } from "../lib/token";
import { getTodayUsage } from "../lib/rateLimit";

export async function tokenAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });

  const { rows } = await pool.query(
    `SELECT id, user_id, scope, daily_limit, expires_at, revoked_at
       FROM api_tokens WHERE token_hash = $1`,
    [hashToken(token)]
  );
  const t = rows[0];
  if (!t) return res.status(401).json({ error: "invalid token" });
  if (t.revoked_at) return res.status(403).json({ error: "token revoked" });
  if (t.expires_at && new Date(t.expires_at) < new Date())
    return res.status(403).json({ error: "token expired" });

  const used = await getTodayUsage(t.id);
  if (used >= t.daily_limit) return res.status(429).json({ error: "daily limit reached" });

  await pool.query("UPDATE api_tokens SET last_used_at = now() WHERE id = $1", [t.id]);
  req.auth = { tokenId: t.id, userId: t.user_id, scope: t.scope };
  next();
}
```

- [ ] **Step 7: Run unit tests**

Run: `cd backend && bun test tests/token.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Write the integration test** — `backend/tests/integration.auth.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashToken } from "../src/lib/token";
import { hashPassword } from "../src/lib/passwords";
import { Router } from "express";
import { tokenAuth } from "../src/middleware/tokenAuth";

// test endpoint yang butuh tokenAuth
function buildApp() {
  const app = createApp();
  const router = Router();
  router.post("/ping", tokenAuth, (req, res) => res.json({ auth: req.auth }));
  app.use("/api", router);
  return app;
}

const app = buildApp();

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  const user = await testDb.query(
    "INSERT INTO users (name, email, unit_kerja, password_hash, is_admin) VALUES ('Uji','a@b.c','Uji',$1,FALSE) RETURNING id",
    [hashPassword("x")]
  );
  await testDb.query(
    "INSERT INTO api_tokens (user_id, name, token_hash, scope, daily_limit) VALUES ($1,'t','$2','internal-read',2)",
    [user.rows[0].id, hashToken("mih_ok")]
  );
});

afterAll(async () => {
  await truncateAll();
  await testDb.end();
});

test("valid token passes", async () => {
  const res = await request(app).post("/api/ping").set("Authorization", "Bearer mih_ok");
  expect(res.status).toBe(200);
  expect(res.body.auth.scope).toBe("internal-read");
});

test("missing token returns 401", async () => {
  const res = await request(app).post("/api/ping");
  expect(res.status).toBe(401);
});

test("revoked token returns 403", async () => {
  await testDb.query("UPDATE api_tokens SET revoked_at=now() WHERE token_hash=$1", [hashToken("mih_ok")]);
  const res = await request(app).post("/api/ping").set("Authorization", "Bearer mih_ok");
  expect(res.status).toBe(403);
});
```

- [ ] **Step 9: Run integration tests**

```bash
cd backend && bun test tests/integration.auth.test.ts
```
Expected: PASS (3 tests) — pastikan `bash scripts/dev-db.sh` sudah dijalankan (db di port 5432 + database `mih_test`).

- [ ] **Step 10: Commit**

```bash
git add backend
git commit -m "feat(backend): token hashing, auth middleware, rate limit"
```

---

## Task 8: LLM/embedding services + RAG + `POST /api/ask`

**Files:**
- Create: `backend/src/services/embeddings.ts`, `backend/src/services/llm.ts`, `backend/src/services/rag.ts`, `backend/src/routes/ask.ts`
- Modify: `backend/src/app.ts` (mount `askRoutes`)
- Create: `backend/tests/citations.test.ts`, `backend/tests/integration.ask.test.ts`

**Interfaces:**
- Consumes: `config`, `pool`, `tokenAuth` (Task 7).
- Produces: `embeddings.embedTexts(texts) -> number[][]`; `llm.generateAnswer(question, context) -> Promise<string>`; `rag.ask(question) -> { answer, citations }`; `rag.extractCitedIndices(answer) -> Set<number>`; route `POST /api/ask` (token auth), menulis `usage_logs`.

- [ ] **Step 1: Write the failing unit test** — `backend/tests/citations.test.ts`:

```ts
import { test, expect } from "bun:test";
import { extractCitedIndices } from "../src/services/rag";

test("extracts [n] citation markers", () => {
  const s = extractCitedIndices("Menurut [1] dan [3], target [12] tercapai.");
  expect([...s].sort((a, b) => a - b)).toEqual([1, 3, 12]);
});

test("no markers returns empty set", () => {
  expect(extractCitedIndices("Tidak ada rujukan.").size).toBe(0);
});
```

- [ ] **Step 2: Write the failing service stubs**

`backend/src/services/embeddings.ts`:

```ts
import OpenAI from "openai";
import { config } from "../config";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (config.llmProvider === "mock") {
    return texts.map(() => Array.from({ length: config.embeddingDim }, () => 0));
  }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const resp = await client.embeddings.create({ model: config.embeddingModel, input: batch });
    out.push(...resp.data.map((d) => d.embedding));
  }
  return out;
}
```

`backend/src/services/llm.ts`:

```ts
import OpenAI from "openai";
import { config } from "../config";

const SYSTEM_PROMPT = [
  "Anda adalah asisten AI internal Kedeputian Perencanaan Makro Pembangunan.",
  "Jawab dalam Bahasa Indonesia, gunakan HANYA konteks yang diberikan.",
  "Jika konteks tidak cukup, jawab 'Saya tidak menemukan informasi tersebut dalam dokumen yang tersedia.'",
  "Wajib merujuk sumber dengan format [n] sesuai daftar konteks, contoh: 'Menurut [1] ...'.",
].join("\n");

export async function generateAnswer(question: string, context: string): Promise<string> {
  if (config.llmProvider === "mock") {
    return `Jawaban (mock) berdasarkan [1]: ${question}`;
  }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const resp = await client.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pertanyaan: ${question}\n\nKonteks:\n${context}` },
    ],
  });
  return resp.choices[0]?.message?.content ?? "";
}
```

`backend/src/services/rag.ts`:

```ts
import { pool } from "../db";
import { config } from "../config";
import { generateAnswer } from "./llm";
import { embedTexts } from "./embeddings";

export interface Citation {
  document_id: number;
  filename: string;
  file_type: string;
  page_or_slide: number | null;
  section_title: string | null;
}

export function extractCitedIndices(answer: string): Set<number> {
  const set = new Set<number>();
  const re = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer))) set.add(Number(m[1]));
  return set;
}

export async function ask(question: string): Promise<{ answer: string; citations: Citation[] }> {
  const [qv] = await embedTexts([question]);
  const { rows } = await pool.query(
    `SELECT c.id, c.content, c.page_or_slide, c.section_title,
            d.id AS document_id, d.filename, d.file_type
       FROM chunks c JOIN documents d ON d.id = c.document_id
      WHERE c.is_outdated = FALSE
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [JSON.stringify(qv), config.vectorK]
  );
  const labeled = rows.map((r, i) => ({ ...r, label: i + 1 }));
  const context = labeled
    .map((r) =>
      `[${r.label}] (File: ${r.filename}, ${r.file_type}` +
      (r.page_or_slide != null ? `, halaman/slide ${r.page_or_slide}` : "") +
      (r.section_title ? `, Bagian: ${r.section_title}` : "") + `)\n${r.content}`
    )
    .join("\n\n---\n\n");

  const answer = await generateAnswer(question, context);
  const cited = extractCitedIndices(answer);
  const citations: Citation[] = labeled
    .filter((r) => cited.has(r.label))
    .map((r) => ({
      document_id: r.document_id,
      filename: r.filename,
      file_type: r.file_type,
      page_or_slide: r.page_or_slide,
      section_title: r.section_title,
    }));
  return { answer, citations };
}
```

- [ ] **Step 3: Write `backend/src/routes/ask.ts`**:

```ts
import { Router } from "express";
import { pool } from "../db";
import { config } from "../config";
import { tokenAuth } from "../middleware/tokenAuth";
import { ask } from "../services/rag";

const router = Router();

router.post("/ask", tokenAuth, async (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) return res.status(400).json({ error: "question required" });

  const started = Date.now();
  const result = await ask(question);
  const latency_ms = Date.now() - started;

  await pool.query(
    `INSERT INTO usage_logs (token_id, user_id, question, answer, cited_chunks, model, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.auth!.tokenId,
      req.auth!.userId,
      question,
      result.answer,
      JSON.stringify(result.citations),
      config.openaiModel,
      latency_ms,
    ]
  );
  res.json(result);
});

export default router;
```

- [ ] **Step 4: Mount route in `backend/src/app.ts`**:

```ts
import express, { type NextFunction, type Request, type Response } from "express";
import { loadSession } from "./middleware/sessionAuth";
import askRoutes from "./routes/ask";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(loadSession);
  app.use("/api", askRoutes);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });
  return app;
}
```

- [ ] **Step 5: Run unit tests**

Run: `cd backend && bun test tests/citations.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the integration test** — `backend/tests/integration.ask.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashToken } from "../src/lib/token";
import { hashPassword } from "../src/lib/passwords";

const app = createApp();

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  const zero = JSON.stringify(Array.from({ length: 1536 }, () => 0));
  const doc = await testDb.query(
    `INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status)
     VALUES ('paparan-uji.pptx','paparan','pptx','hash1','/data/uploaded/x.pptx','completed') RETURNING id`
  );
  await testDb.query(
    `INSERT INTO chunks (document_id, content, embedding, page_or_slide, section_title, chunk_index)
     VALUES ($1,$2,$3::vector,4,'Pendahuluan',0)`,
    [doc.rows[0].id, "Kedeputian merencanakan pembangunan makro untuk tahun depan.", zero]
  );
  const user = await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Uji','u@t.c','Uji',$1,FALSE) RETURNING id",
    [hashPassword("x")]
  );
  await testDb.query(
    "INSERT INTO api_tokens (user_id,name,token_hash,scope,daily_limit) VALUES ($1,'t','$2','internal-read',10)",
    [user.rows[0].id, hashToken("mih_ask")]
  );
});

afterAll(async () => {
  await truncateAll();
  await testDb.end();
});

test("POST /api/ask returns answer and citations", async () => {
  const res = await request(app)
    .post("/api/ask")
    .set("Authorization", "Bearer mih_ask")
    .send({ question: "Apa rencana pembangunan makro?" });
  expect(res.status).toBe(200);
  expect(res.body.answer.length).toBeGreaterThan(0);
  expect(res.body.citations.length).toBeGreaterThan(0);
  expect(res.body.citations[0].filename).toBe("paparan-uji.pptx");
  expect(res.body.citations[0].page_or_slide).toBe(4);
});

test("POST /api/ask rejects unknown token", async () => {
  const res = await request(app)
    .post("/api/ask")
    .set("Authorization", "Bearer mih_wrong")
    .send({ question: "x" });
  expect(res.status).toBe(401);
});

test("usage_logs records the request", async () => {
  const { rows } = await testDb.query(
    "SELECT question, cited_chunks FROM usage_logs ORDER BY id DESC LIMIT 1"
  );
  expect(rows[0].question).toBe("Apa rencana pembangunan makro?");
  expect(Array.isArray(rows[0].cited_chunks)).toBe(true);
});
```

- [ ] **Step 7: Run integration tests**

Run: `cd backend && bun test tests/`
Expected: PASS — semua test hijau (token, integration.auth, citations, integration.ask).

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(backend): RAG /api/ask with citations and usage logging"
```

---

## Task 9: Portal sessions (login / me / logout)

**Files:**
- Create: `backend/src/lib/session.ts`, `backend/src/middleware/sessionAuth.ts` (lengkapi), `backend/src/routes/auth.ts`
- Modify: `backend/src/app.ts` (mount `authRoutes`)
- Create: `backend/tests/session.test.ts`, `backend/tests/integration.auth.test.ts` (extend login cases)

**Interfaces:**
- Consumes: `pool`, `hashPassword/verifyPassword` (Task 7).
- Produces: `encodeSession(payload) -> string`, `decodeSession(cookie) -> Record|null`; middleware `loadSession`, `requireLogin`, `requireAdmin`, `setSession(req,res,payload)`, `clearSession(req,res)`; routes `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

- [ ] **Step 1: Write the failing unit test** — `backend/tests/session.test.ts`:

```ts
import { test, expect } from "bun:test";
import { encodeSession, decodeSession } from "../src/lib/session";

test("session encode/decode round-trip", () => {
  const cookie = encodeSession({ userId: 7, isAdmin: true });
  const data = decodeSession(cookie);
  expect(data?.userId).toBe(7);
  expect(data?.isAdmin).toBe(true);
});

test("tampered cookie is rejected", () => {
  const cookie = encodeSession({ userId: 7 });
  const forged = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
  expect(decodeSession(forged)).toBeNull();
});
```

- [ ] **Step 2: Write `backend/src/lib/session.ts`**:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config";

function sign(value: string): string {
  return createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
}

export function encodeSession(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(cookie: string | undefined): Record<string, unknown> | null {
  if (!cookie) return null;
  const [body, sig] = cookie.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Replace the stub `backend/src/middleware/sessionAuth.ts`**:

```ts
import type { Request, Response, NextFunction } from "express";
import { decodeSession, encodeSession } from "../lib/session";

export const SESSION_COOKIE = "mih_session";

function readCookie(req: Request): string | undefined {
  const header = req.headers.cookie ?? "";
  const found = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return found ? found.slice(SESSION_COOKIE.length + 1) : undefined;
}

export function loadSession(req: Request, _res: Response, next: NextFunction) {
  req.session = decodeSession(readCookie(req)) ?? {};
  next();
}

export function setSession(req: Request, res: Response, payload: Record<string, unknown>) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeSession(payload)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`
  );
  req.session = payload;
}

export function clearSession(req: Request, res: Response) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  req.session = {};
}

export function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "not logged in" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "not logged in" });
  if (!req.session?.isAdmin) return res.status(403).json({ error: "admin only" });
  next();
}
```

- [ ] **Step 4: Write `backend/src/routes/auth.ts`**:

```ts
import { Router } from "express";
import { pool } from "../db";
import { verifyPassword } from "../lib/passwords";
import { setSession, clearSession, requireLogin } from "../middleware/sessionAuth";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase();
  const password = String(req.body?.password ?? "");
  const { rows } = await pool.query(
    "SELECT id, name, email, unit_kerja, is_admin, password_hash FROM users WHERE email=$1",
    [email]
  );
  const u = rows[0];
  if (!u || !verifyPassword(password, u.password_hash)) {
    return res.status(401).json({ error: "email atau password salah" });
  }
  setSession(req, res, { userId: u.id, isAdmin: u.is_admin });
  res.json({
    user: { id: u.id, name: u.name, email: u.email, unit_kerja: u.unit_kerja, is_admin: u.is_admin },
  });
});

router.post("/auth/logout", (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

router.get("/auth/me", requireLogin, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, email, unit_kerja, is_admin FROM users WHERE id=$1",
    [req.session!.userId]
  );
  res.json({ user: rows[0] });
});

export default router;
```

- [ ] **Step 5: Mount route in `backend/src/app.ts`**:

```ts
import express, { type NextFunction, type Request, type Response } from "express";
import { loadSession } from "./middleware/sessionAuth";
import askRoutes from "./routes/ask";
import authRoutes from "./routes/auth";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(loadSession);
  app.use("/api", askRoutes);
  app.use("/api", authRoutes);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });
  return app;
}
```

- [ ] **Step 6: Extend integration auth test with login** — tambahkan ke `backend/tests/integration.auth.test.ts`:

```ts
test("login + me round-trip", async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "a@b.c", password: "x" });
  expect(login.status).toBe(200);
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
  expect(me.status).toBe(200);
  expect(me.body.user.email).toBe("a@b.c");
});

test("wrong password returns 401", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: "a@b.c", password: "salah" });
  expect(res.status).toBe(401);
});
```

(Catatan: user `a@b.c` sudah dibuat di `beforeAll` dengan password `x`.)

- [ ] **Step 7: Run all tests**

Run: `cd backend && bun test tests/`
Expected: PASS — semua test hijau.

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(backend): signed-session portal auth (login/me/logout)"
```

---

## Task 10: Admin endpoints — users & tokens

**Files:**
- Create: `backend/src/routes/admin.ts` (users + tokens bagian; dokumen menyusul Task 11)
- Modify: `backend/src/app.ts` (mount `adminRoutes` at `/api/admin`)
- Create: `backend/tests/integration.admin.test.ts`

**Interfaces:**
- Consumes: `requireLogin`, `requireAdmin` (Task 9), `generateToken/hashToken` (Task 7), `hashPassword` (Task 7).
- Produces: `GET /api/admin/users`, `POST /api/admin/users`, `POST /api/admin/users/:id/tokens` (return plaintext once), `GET /api/admin/tokens`, `POST /api/admin/tokens/:id/revoke`.

- [ ] **Step 1: Write the failing integration test** — `backend/tests/integration.admin.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashPassword } from "../src/lib/passwords";

const app = createApp();
let cookie = "";

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Admin','admin@x.c','Uji',$1,TRUE)",
    [hashPassword("adminpw")]
  );
  await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Staf','staff@x.c','Uji',$1,FALSE)",
    [hashPassword("stafpw")]
  );
  const login = await request(app).post("/api/auth/login").send({ email: "admin@x.c", password: "adminpw" });
  cookie = login.headers["set-cookie"][0].split(";")[0];
});

afterAll(async () => {
  await truncateAll();
  await testDb.end();
});

test("admin can list users", async () => {
  const res = await request(app).get("/api/admin/users").set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(2);
});

test("admin can create user", async () => {
  const res = await request(app)
    .post("/api/admin/users")
    .set("Cookie", cookie)
    .send({ name: "Baru", email: "baru@x.c", unit_kerja: "Subdit", password: "pw123", is_admin: false });
  expect(res.status).toBe(201);
  expect(res.body.email).toBe("baru@x.c");
});

test("duplicate email returns 409", async () => {
  const res = await request(app)
    .post("/api/admin/users")
    .set("Cookie", cookie)
    .send({ name: "Dup", email: "baru@x.c", unit_kerja: "x", password: "pw" });
  expect(res.status).toBe(409);
});

test("generate token shows plaintext once and works for /ask", async () => {
  const list = await request(app).get("/api/admin/users").set("Cookie", cookie);
  const staf = list.body.find((u: any) => u.email === "staf@x.c");
  const created = await request(app)
    .post(`/api/admin/users/${staf.id}/tokens`)
    .set("Cookie", cookie)
    .send({ name: "integrasi", scope: "internal-read", daily_limit: 50 });
  expect(created.status).toBe(201);
  expect(created.body.token).toMatch(/^mih_/);

  const ask = await request(app)
    .post("/api/ask")
    .set("Authorization", `Bearer ${created.body.token}`)
    .send({ question: "q" });
  expect(ask.status).toBe(200);
});

test("non-admin cannot access admin endpoints", async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "staf@x.c", password: "stafpw" });
  const staffCookie = login.headers["set-cookie"][0].split(";")[0];
  const res = await request(app).get("/api/admin/users").set("Cookie", staffCookie);
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && bun test tests/integration.admin.test.ts`
Expected: FAIL — route `/api/admin/users` belum ada (404).

- [ ] **Step 3: Write `backend/src/routes/admin.ts`**:

```ts
import { Router } from "express";
import { pool } from "../db";
import { hashPassword } from "../lib/passwords";
import { generateToken, hashToken } from "../lib/token";
import { requireLogin, requireAdmin } from "../middleware/sessionAuth";

const router = Router();

// ---- users ----
router.get("/users", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, email, unit_kerja, is_admin, created_at FROM users ORDER BY id"
  );
  res.json(rows);
});

router.post("/users", requireAdmin, async (req, res) => {
  const { name, email, unit_kerja, password, is_admin } = req.body ?? {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email, dan password wajib" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, unit_kerja, password_hash, is_admin)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, unit_kerja, is_admin`,
      [String(name), String(email).toLowerCase(), String(unit_kerja ?? ""), hashPassword(String(password)), Boolean(is_admin)]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === "23505") return res.status(409).json({ error: "email sudah terdaftar" });
    throw e;
  }
});

// ---- api tokens ----
router.post("/users/:id/tokens", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const token = generateToken();
  await pool.query(
    `INSERT INTO api_tokens (user_id, name, token_hash, scope, daily_limit, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      userId,
      String(req.body?.name ?? "default"),
      hashToken(token),
      String(req.body?.scope ?? "internal-read"),
      Number(req.body?.daily_limit ?? 100),
      req.body?.expires_at ? new Date(req.body.expires_at) : null,
    ]
  );
  res.status(201).json({ token, note: "Simpan token ini — tidak akan ditampilkan lagi." });
});

router.get("/tokens", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.user_id, u.email, t.name, t.scope, t.daily_limit,
            t.expires_at, t.revoked_at, t.last_used_at, t.created_at
       FROM api_tokens t JOIN users u ON u.id = t.user_id
      ORDER BY t.id`
  );
  res.json(rows);
});

router.post("/tokens/:id/revoke", requireAdmin, async (req, res) => {
  await pool.query("UPDATE api_tokens SET revoked_at = now() WHERE id=$1", [Number(req.params.id)]);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Mount route in `backend/src/app.ts`**:

```ts
import express, { type NextFunction, type Request, type Response } from "express";
import { loadSession } from "./middleware/sessionAuth";
import askRoutes from "./routes/ask";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(loadSession);
  app.use("/api", askRoutes);
  app.use("/api", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });
  return app;
}
```

- [ ] **Step 5: Run tests**

Run: `cd backend && bun test tests/integration.admin.test.ts`
Expected: PASS (5 tests). Pastikan `bash scripts/dev-db.sh` sudah jalan.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(backend): admin endpoints for users and api tokens"
```

---

## Task 11: Documents endpoints (list + upload with dedup) + seed script

**Files:**
- Modify: `backend/src/routes/admin.ts` (tambah `GET/POST /documents`)
- Create: `backend/scripts/seed.ts`
- Create: `backend/tests/integration.documents.test.ts`

**Interfaces:**
- Consumes: `config.dataDir`, `requireLogin` (Task 9), `sha256` via `node:crypto`.
- Produces: `GET /api/admin/documents`, `POST /api/admin/documents` (multer single `file`, field `file_type` opsional, 409 jika duplikat); `bun run seed` membuat admin dari env `ADMIN_EMAIL`/`ADMIN_PASSWORD` (idempotent).

- [ ] **Step 1: Write the failing integration test** — `backend/tests/integration.documents.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashPassword } from "../src/lib/passwords";

const app = createApp();
let cookie = "";

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Admin','a@d.c','Uji',$1,TRUE)",
    [hashPassword("pw")]
  );
  const login = await request(app).post("/api/auth/login").send({ email: "a@d.c", password: "pw" });
  cookie = login.headers["set-cookie"][0].split(";")[0];
});

afterAll(async () => {
  await truncateAll();
  await testDb.end();
});

test("upload creates pending document", async () => {
  const res = await request(app)
    .post("/api/admin/documents")
    .set("Cookie", cookie)
    .attach("file", Buffer.from("dummy pdf bytes"), "contoh-laporan.pdf");
  expect(res.status).toBe(201);
  expect(res.body.status).toBe("pending");
  expect(res.body.file_type).toBe("laporan");
});

test("duplicate upload returns 409", async () => {
  const res = await request(app)
    .post("/api/admin/documents")
    .set("Cookie", cookie)
    .attach("file", Buffer.from("dummy pdf bytes"), "contoh-laporan.pdf");
  expect(res.status).toBe(409);
});

test("list documents shows uploaded file", async () => {
  const res = await request(app).get("/api/admin/documents").set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.some((d: any) => d.filename === "contoh-laporan.pdf")).toBe(true);
});

test("unsupported extension rejected", async () => {
  const res = await request(app)
    .post("/api/admin/documents")
    .set("Cookie", cookie)
    .attach("file", Buffer.from("x"), "malware.exe");
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && bun test tests/integration.documents.test.ts`
Expected: FAIL — `POST /api/admin/documents` 404.

- [ ] **Step 3: Extend `backend/src/routes/admin.ts`** (impor + endpoint dokumen):

Tambah di atas `export default router;`:

```ts
import { randomBytes, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import multer from "multer";
import { config } from "../config";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ---- documents ----
router.get("/documents", requireLogin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, filename, file_type, file_extension, status, error_message, chunk_count,
            created_at, updated_at FROM documents ORDER BY id DESC`
  );
  res.json(rows);
});

router.post("/documents", requireLogin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file wajib" });
  const buf = req.file.buffer;
  const ext = path.extname(req.file.originalname).toLowerCase().slice(1);
  if (!["pptx", "pdf", "docx"].includes(ext))
    return res.status(400).json({ error: "hanya pptx/pdf/docx" });

  const hash = sha256(buf);
  const dup = await pool.query("SELECT 1 FROM documents WHERE sha256=$1", [hash]);
  if ((dup.rowCount ?? 0) > 0)
    return res.status(409).json({ error: "dokumen sudah ada (duplikat)" });

  const fileType = req.body.file_type || (ext === "pptx" ? "paparan" : "laporan");
  const dir = path.join(config.dataDir, "uploaded");
  await fs.mkdir(dir, { recursive: true });
  const safeName = `${Date.now()}-${req.file.originalname.replace(/[^\w.\-]+/g, "_")}`;
  const filePath = path.join(dir, safeName);
  await fs.writeFile(filePath, buf);

  const { rows } = await pool.query(
    `INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status)
     VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id, filename, status`,
    [req.file.originalname, fileType, ext, hash, filePath]
  );
  res.status(201).json(rows[0]);
});
```

- [ ] **Step 4: Write `backend/scripts/seed.ts`**:

```ts
import { pool } from "../src/db";
import { hashPassword } from "../src/lib/passwords";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@kedeputian.go.id").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "change-me";
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, unit_kerja, password_hash, is_admin)
     VALUES ($1,$2,$3,$4,TRUE)
     ON CONFLICT (email) DO UPDATE SET is_admin = TRUE
     RETURNING id, email`,
    ["Admin", email, "Kedeputian", hashPassword(password)]
  );
  console.log("admin siap:", rows[0].email);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Run tests**

Run: `cd backend && bun test tests/integration.documents.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify seed script**

```bash
cd backend && DATABASE_URL=postgres://mih:mih@localhost:5432/mih bun run seed
```
Expected: `admin siap: admin@kedeputian.go.id`. Jalankan lagi — idempotent, tidak error.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(backend): document upload with dedup and seed script"
```

---

## Task 12: Frontend scaffold (Vite + React + Tailwind + router + API client)

**Files:**
- Create: `frontend/` via `npm create vite` template
- Create: `frontend/vite.config.ts`, `frontend/src/index.css`, `frontend/src/api.ts`, `frontend/src/main.tsx`, `frontend/src/App.tsx` (skeleton + layout + route shells)

**Interfaces:**
- Consumes: backend routes (`/api/*`).
- Produces: `src/api.ts` client (`api.login/logout/me/ask/users/createUser/tokens/createToken/revokeToken/usageLogs/documents/uploadDocument`); typed interfaces `User`, `Token`, `DocumentRow`, `AskResult`, `Citation`; router shell dengan halaman `Login`, `Playground`, `Documents`, `Admin`.

- [ ] **Step 1: Scaffold the app**

```bash
cd "/c/Users/PMP/OneDrive/Desktop/MVP MIH"
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Write `frontend/vite.config.ts`**:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

- [ ] **Step 3: Write `frontend/src/index.css`**:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Write `frontend/src/api.ts`**:

```ts
export interface User {
  id: number; name: string; email: string; unit_kerja: string; is_admin: boolean;
}
export interface Token {
  id: number; user_id: number; email: string; name: string; scope: string;
  daily_limit: number; expires_at: string | null; revoked_at: string | null;
  last_used_at: string | null;
}
export interface DocumentRow {
  id: number; filename: string; file_type: string; file_extension: string;
  status: string; error_message: string | null; chunk_count: number;
  created_at: string; updated_at: string;
}
export interface Citation {
  document_id: number; filename: string; file_type: string;
  page_or_slide: number | null; section_title: string | null;
}
export interface AskResult { answer: string; citations: Citation[]; }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> =
    init?.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const res = await fetch(path, { credentials: "same-origin", ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    req<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => req<{ user: User }>("/api/auth/me"),
  ask: (question: string) =>
    req<AskResult>("/api/ask", { method: "POST", body: JSON.stringify({ question }) }),
  users: () => req<User[]>("/api/admin/users"),
  createUser: (u: { name: string; email: string; unit_kerja: string; password: string; is_admin: boolean }) =>
    req<User>("/api/admin/users", { method: "POST", body: JSON.stringify(u) }),
  tokens: () => req<Token[]>("/api/admin/tokens"),
  createToken: (userId: number, opts: { name?: string; scope?: string; daily_limit?: number }) =>
    req<{ token: string; note: string }>(`/api/admin/users/${userId}/tokens`, { method: "POST", body: JSON.stringify(opts) }),
  revokeToken: (id: number) => req<{ ok: boolean }>(`/api/admin/tokens/${id}/revoke`, { method: "POST" }),
  usageLogs: () => req<any[]>("/api/admin/usage-logs"),
  documents: () => req<DocumentRow[]>("/api/admin/documents"),
  uploadDocument: (file: File, fileType?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (fileType) fd.append("file_type", fileType);
    return req<DocumentRow>("/api/admin/documents", { method: "POST", body: fd });
  },
};
```

- [ ] **Step 5: Write `frontend/src/main.tsx`**:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 6: Write `frontend/src/App.tsx`** (skeleton + layout):

```tsx
import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { api, type User } from "./api";
import Login from "./pages/Login";
import Playground from "./pages/Playground";
import Documents from "./pages/Documents";
import Admin from "./pages/Admin";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center">Memuat…</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="flex items-center gap-4 bg-slate-800 px-6 py-3 text-white">
        <span className="font-semibold">MVP MIH</span>
        <NavLink to="/playground" className="hover:underline">Playground</NavLink>
        <NavLink to="/documents" className="hover:underline">Dokumen</NavLink>
        {user.is_admin && <NavLink to="/admin" className="hover:underline">Admin</NavLink>}
        <span className="ml-auto text-sm">
          {user.name} ·{" "}
          <button className="underline" onClick={() => api.logout().finally(() => setUser(null))}>Keluar</button>
        </span>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/playground" />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/admin" element={user.is_admin ? <Admin /> : <Navigate to="/playground" />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 7: Create page stubs** (agar build lulus):

`frontend/src/pages/Login.tsx`, `Playground.tsx`, `Documents.tsx`, `Admin.tsx` — masing-masing default export komponen minimal:

```tsx
export default function Login({ onLogin }: { onLogin: (u: any) => void }) {
  return <div className="p-6">Login (dibuat di Task 13)</div>;
}
```
(Untuk sementara; akan diisi penuh di Task 13–15.)

- [ ] **Step 8: Verify build**

```bash
cd frontend && npm run build
```
Expected: build sukses tanpa error TypeScript.

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold vite+react+tailwind with api client and layout"
```

---

## Task 13: Login page

**Files:**
- Modify: `frontend/src/pages/Login.tsx`

**Interfaces:**
- Consumes: `api.login` (Task 12).
- Produces: komponen login lengkap (email + password + error state), menerima `onLogin(user)`.

- [ ] **Step 1: Write `frontend/src/pages/Login.tsx`**:

```tsx
import { useState } from "react";
import { api, type User } from "../api";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api.login(email, password);
      onLogin(r.user);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-800">
      <form onSubmit={submit} className="w-80 rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-4 text-xl font-semibold">Masuk — MVP MIH</h1>
        {error && (
          <p className="mb-3 rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm">
          Password
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="mt-4 w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700">
          Masuk
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: sukses.

- [ ] **Step 3: Manual smoke (opsional, butuh backend jalan)**

```bash
cd backend && bun run dev &
cd frontend && npm run dev
```
Buka `http://localhost:5173` → halaman login muncul.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat(frontend): login page"
```

---

## Task 14: Playground page

**Files:**
- Modify: `frontend/src/pages/Playground.tsx`

**Interfaces:**
- Consumes: `api.ask` (Task 12).
- Produces: form tanya-jawab dengan jawaban + daftar sitasi.

- [ ] **Step 1: Write `frontend/src/pages/Playground.tsx`**:

```tsx
import { useState } from "react";
import { api, type AskResult } from "../api";

export default function Playground() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResult(await api.ask(question));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Tanya-jawab dokumen</h1>
      <textarea
        className="w-full rounded border px-3 py-2"
        rows={4}
        placeholder="Tulis pertanyaan tentang dokumen kedeputian…"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button
        className="mt-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        onClick={ask}
        disabled={loading}
      >
        {loading ? "Memproses…" : "Tanya"}
      </button>
      {error && <p className="mt-3 rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Jawaban</h2>
          <p className="mt-2 whitespace-pre-wrap rounded border bg-white p-4">{result.answer}</p>
          {result.citations.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold">Sumber rujukan</h3>
              <ul className="mt-2 space-y-1">
                {result.citations.map((c, i) => (
                  <li key={i} className="rounded border bg-white px-3 py-2 text-sm">
                    <span className="font-medium">{c.filename}</span>
                    {c.page_or_slide != null && <span> — halaman/slide {c.page_or_slide}</span>}
                    {c.section_title && <span> — {c.section_title}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: sukses.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Playground.tsx
git commit -m "feat(frontend): playground Q&A page with citations"
```

---

## Task 15: Admin + Documents pages

**Files:**
- Modify: `frontend/src/pages/Admin.tsx`, `frontend/src/pages/Documents.tsx`

**Interfaces:**
- Consumes: `api.users/createUser/tokens/createToken/revokeToken/usageLogs/documents/uploadDocument` (Task 12).

- [ ] **Step 1: Write `frontend/src/pages/Admin.tsx`**:

```tsx
import { useEffect, useState } from "react";
import { api, type Token, type User } from "../api";

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
  const [tokenUser, setTokenUser] = useState(0);
  const [tokenName, setTokenName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);

  async function load() {
    try {
      const [u, t, l] = await Promise.all([api.users(), api.tokens(), api.usageLogs()]);
      setUsers(u); setTokens(t); setLogs(l);
      if (!tokenUser && u.length) setTokenUser(u[0].id);
    } catch (err: any) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    await api.createUser(newUser);
    setNewUser({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
    load();
  }

  async function createToken() {
    const r = await api.createToken(tokenUser, { name: tokenName || undefined });
    setFreshToken(r.token);
    setTokenName("");
    load();
  }

  async function revoke(id: number) {
    await api.revokeToken(id);
    load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Buat user</h2>
        <form onSubmit={createUser} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Nama" value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
          <input className="rounded border px-3 py-2" type="email" placeholder="Email" value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
          <input className="rounded border px-3 py-2" placeholder="Unit kerja" value={newUser.unit_kerja}
            onChange={(e) => setNewUser({ ...newUser, unit_kerja: e.target.value })} />
          <input className="rounded border px-3 py-2" type="password" placeholder="Password" value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={newUser.is_admin}
              onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} />
            Admin
          </label>
          <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Simpan</button>
        </form>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Generate token</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            User
            <select className="ml-2 rounded border px-2 py-1" value={tokenUser} onChange={(e) => setTokenUser(Number(e.target.value))}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
          </label>
          <input className="rounded border px-3 py-1" placeholder="Nama token" value={tokenName}
            onChange={(e) => setTokenName(e.target.value)} />
          <button className="rounded bg-blue-600 px-4 py-1 text-white hover:bg-blue-700" onClick={createToken}>Generate</button>
        </div>
        {freshToken && (
          <div className="mt-3 rounded border-2 border-amber-400 bg-amber-50 p-3 text-sm">
            <p className="font-semibold">Simpan token ini — tidak akan tampil lagi:</p>
            <code className="mt-1 block break-all">{freshToken}</code>
          </div>
        )}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Token aktif</h2>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="border-b text-left"><th>Nama</th><th>User</th><th>Scope</th><th>Batas/hari</th><th>Status</th><th /></tr></thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className="border-b">
                <td>{t.name}</td><td>{t.email}</td><td>{t.scope}</td>
                <td>{t.daily_limit}</td>
                <td>{t.revoked_at ? <span className="text-red-600">revoked</span> : <span className="text-green-600">aktif</span>}</td>
                <td>{!t.revoked_at && <button className="text-red-600 underline" onClick={() => revoke(t.id)}>Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Log pemakaian</h2>
        <div className="mt-2 max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th>Waktu</th><th>Token</th><th>Pertanyaan</th><th>Latensi</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.token_name}</td>
                  <td>{l.question}</td>
                  <td>{l.latency_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/src/pages/Documents.tsx`**:

```tsx
import { useEffect, useState } from "react";
import { api, type DocumentRow } from "../api";

const BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function Documents() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setDocs(await api.documents());
    } catch (err: any) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    try {
      await api.uploadDocument(file, fileType || undefined);
      setFile(null);
      setFileType("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Dokumen</h1>
      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={upload} className="rounded border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <input type="file" accept=".pptx,.pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <select className="rounded border px-2 py-1 text-sm" value={fileType} onChange={(e) => setFileType(e.target.value)}>
            <option value="">Otomatis</option>
            <option value="paparan">Paparan</option>
            <option value="laporan">Laporan</option>
            <option value="lainnya">Lainnya</option>
          </select>
          <button className="rounded bg-blue-600 px-4 py-1 text-white hover:bg-blue-700" disabled={!file}>Upload</button>
        </div>
      </form>

      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="rounded border bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{d.filename}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${BADGE[d.status] ?? "bg-slate-100"}`}>{d.status}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {d.file_type} · {d.chunk_count} chunk
              {d.error_message && <span className="ml-2 text-red-600">{d.error_message}</span>}
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-sm text-slate-500">Belum ada dokumen.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: sukses.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages
git commit -m "feat(frontend): admin (users/tokens/logs) and documents pages"
```

---

## Task 16: Docker Compose + Dockerfiles + nginx + README

**Files:**
- Create: `backend/Dockerfile`, `worker/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`
- Create: `docker-compose.yml`, `README.md`
- Create: `worker/scripts/make_samples.py`

**Interfaces:**
- Consumes: seluruh code dari Task 1–15.
- Produces: `docker compose up` → frontend `http://localhost:8080`, backend `:3000`, db `db:5432`.

- [ ] **Step 1: Write `backend/Dockerfile`**:

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

- [ ] **Step 2: Write `worker/Dockerfile`**:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && python -c "import tiktoken; tiktoken.get_encoding('cl100k_base')"
COPY . .
CMD ["python", "ingest.py", "watch"]
```

- [ ] **Step 3: Write `worker/scripts/make_samples.py`**:

```python
"""Generate sample documents for smoke testing."""
import argparse
from pathlib import Path

from pptx import Presentation
from docx import Document
from reportlab.pdfgen import canvas


def write_pptx(path: Path):
    prs = Presentation()
    for i in range(3):
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = f"Paparan Rencana Pembangunan — Slide {i + 1}"
        body = slide.placeholders[1].text_frame
        body.text = ("Kedeputian Perencanaan Makro merancang arah pembangunan "
                     "jangka menengah. Prioritas meliputi pertumbuhan ekonomi "
                     "inklusif dan pemerataan infrastruktur.")
        slide.notes_slide.notes_text_frame.text = f"Catatan pembicara slide {i + 1}."
    prs.save(str(path))


def write_pdf(path: Path):
    c = canvas.Canvas(str(path))
    for i in range(2):
        c.drawString(72, 740, f"Laporan Perencanaan Makro — Halaman {i + 1}")
        c.drawString(72, 720, "Dokumen ini memuat indikator makro pembangunan nasional.")
        c.showPage()
    c.save()


def write_docx(path: Path):
    doc = Document()
    doc.add_heading("Pendahuluan", level=1)
    doc.add_paragraph("Laporan ini menjelaskan kondisi makro ekonomi terkini.")
    doc.add_heading("Arah Kebijakan", level=1)
    doc.add_paragraph("Kebijakan difokuskan pada stabilitas dan pertumbuhan.")
    doc.save(str(path))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir")
    args = ap.parse_args()
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    write_pptx(out / "paparan-rencana.pptx")
    write_pdf(out / "laporan-makro.pdf")
    write_docx(out / "laporan-makro.docx")
    print("sampel dibuat di", out)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Write `frontend/Dockerfile`**:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

- [ ] **Step 5: Write `frontend/nginx.conf`**:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    try_files $uri /index.html;
  }
}
```

- [ ] **Step 6: Write `docker-compose.yml`**:

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: mih
      POSTGRES_PASSWORD: mih
      POSTGRES_DB: mih
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mih -d mih"]
      interval: 5s
      timeout: 3s
      retries: 12

  backend:
    build: ./backend
    env_file: .env
    environment:
      DATABASE_URL: postgres://mih:mih@db:5432/mih
      DATA_DIR: /data
    volumes:
      - ./data:/data
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3000:3000"

  worker:
    build: ./worker
    env_file: .env
    environment:
      DATABASE_URL: postgres://mih:mih@db:5432/mih
      DATA_DIR: /data
      RAW_DIR: /data/raw
    volumes:
      - ./data:/data
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    depends_on:
      - backend

volumes:
  db_data:
```

- [ ] **Step 7: Write `README.md`**:

```markdown
# MVP MIH — Platform AI Internal Kedeputian Perencanaan Makro Pembangunan

RAG tanya-jawab atas dokumen publik kedeputian (PPTX/PDF/DOCX), diakses lewat API
dengan token, dengan portal admin + playground.

## Menjalankan

1. Salin `.env.example` → `.env`, isi `OPENAI_API_KEY`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
2. `docker compose up -d --build`
3. Buat admin: `docker compose exec backend bun run seed`
4. Buka portal: http://localhost:8080
5. (Opsional) buat sampel: `docker compose exec -T worker python scripts/make_samples.py /data/raw`

## Alur pakai

- Upload/letakkan dokumen di `data/raw` (atau upload lewat halaman Dokumen).
- Worker mengingest otomatis (status di halaman Dokumen).
- Buat token di halaman Admin → pakai token untuk `POST /api/ask`.

```bash
curl -X POST http://localhost:8080/api/ask \
  -H "Authorization: Bearer mih_..." \
  -H "Content-Type: application/json" \
  -d '{"question":"Apa prioritas rencana pembangunan makro?"}'
```

## Pengembangan lokal

- DB: `bash scripts/dev-db.sh` (pgvector di port 5432 + db `mih_test`).
- Backend: `cd backend && bun install && bun run dev` (`bun test` untuk tes).
- Worker: `cd worker && pip install -r requirements.txt && python ingest.py watch`.
- Frontend: `cd frontend && npm install && npm run dev` (proxy `/api` → :3000).
```

- [ ] **Step 8: Verify compose config**

```bash
docker compose config --quiet && echo OK
```
Expected: `OK` (tidak ada error YAML).

- [ ] **Step 9: Commit**

```bash
git add backend/Dockerfile worker/Dockerfile frontend/Dockerfile frontend/nginx.conf \
        worker/scripts/make_samples.py docker-compose.yml README.md
git commit -m "feat(deploy): docker compose for db, worker, backend, frontend"
```

---

## Task 17: End-to-end smoke test

**Files:**
- Create: `backend/scripts/smoke.ts`

**Interfaces:**
- Consumes: seluruh stack yang sudah jalan via docker compose.
- Produces: skrip smoke yang memverifikasi jalur inti: seed → ingest sampel → tanya-jawab dengan token → sitasi.

- [ ] **Step 1: Write `backend/scripts/smoke.ts`**:

```ts
import { pool } from "../src/db";
import { hashPassword } from "../src/lib/passwords";

const base = "http://localhost:3000";
const email = (process.env.ADMIN_EMAIL ?? "admin@kedeputian.go.id").toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "change-me";
const SAMPLE = "paparan-rencana.pptx";

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
  console.log("ok:", msg);
}

async function main() {
  // 1) seed admin (idempotent)
  await pool.query(
    `INSERT INTO users (name,email,unit_kerja,password_hash,is_admin)
     VALUES ('Admin',$1,'Kedeputian',$2,TRUE)
     ON CONFLICT (email) DO UPDATE SET is_admin = TRUE`,
    [email, hashPassword(password)]
  );
  console.log("ok: admin seed");

  // 2) login
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(login.status === 200, "login admin");
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  // 3) buat token
  const users = (await (await fetch(`${base}/api/admin/users`, { headers: { Cookie: cookie } })).json()) as any[];
  const uid = users[0].id;
  const created = (await (await fetch(`${base}/api/users/${uid}/tokens`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "smoke" }),
  })).json()) as { token: string };
  assert(created.token?.startsWith("mih_"), "token dibuat");

  // 4) tunggu ingestion sampel selesai
  const deadline = Date.now() + 120_000;
  let sample: any = null;
  while (Date.now() < deadline) {
    const docs = (await (await fetch(`${base}/api/admin/documents`, { headers: { Cookie: cookie } })).json()) as any[];
    sample = docs.find((d: any) => d.filename === SAMPLE) ?? null;
    if (sample?.status === "completed") break;
    if (sample?.status === "failed") { console.error("FAIL: ingest gagal:", sample.error_message); process.exit(1); }
    await new Promise((r) => setTimeout(r, 2000));
  }
  assert(sample !== null, `sampel ${SAMPLE} terdaftar`);
  assert(sample.status === "completed", "sampel ter-ingest");
  assert(sample.chunk_count > 0, "chunk > 0");

  // 5) tanya-jawab
  const ask = (await (await fetch(`${base}/api/ask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${created.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Apa prioritas rencana pembangunan makro?" }),
  })).json()) as any;
  assert(ask.answer?.length > 0, "ada jawaban");
  assert(Array.isArray(ask.citations) && ask.citations.length > 0, "ada sitasi sumber");

  console.log("SMOKE PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Prepare env + run the stack**

```bash
cp .env.example .env
# isi OPENAI_API_KEY, SESSION_SECRET, ADMIN_PASSWORD di .env
docker compose up -d --build
docker compose ps
```
Expected: empat service `Up` (db healthy).

- [ ] **Step 3: Generate sample docs & run smoke**

```bash
docker compose exec -T worker python scripts/make_samples.py /data/raw
docker compose exec -T backend bun run scripts/smoke.ts
```
Expected output diakhiri `SMOKE PASS`. Jika `ingest gagal` (mis. embedding gagal karena key salah), periksa `.env` dan log worker: `docker compose logs worker`.

- [ ] **Step 4: Verify dedup di jalur nyata**

```bash
docker compose exec -T worker python scripts/make_samples.py /data/raw
docker compose exec -T backend bun run scripts/smoke.ts
```
Expected: `SMOKE PASS` lagi — dokumen yang sama **tidak** diingest dua kali (dedup sha256; jumlah dokumen tidak bertambah).

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/smoke.ts
git commit -m "test(e2e): smoke script for seed→ingest→ask→citations"
```

---

## Self-Review

**1. Spec coverage:**
- Skema DB (documents/chunks/users/api_tokens/usage_logs, is_outdated, token_hash) → Task 1 ✓
- Parser PPTX/PDF/DOCX + tandai perlu OCR → Task 3 ✓
- Chunking struktural 300–800 token, overlap ~15%, metadata sumber → Task 4 ✓
- Dedup sha256 + status + error_message → Task 2/5/11 ✓
- Embedding + simpan vektor → Task 2/5 ✓
- `POST /api/ask` + sitasi + usage_logs + rate limit → Task 7/8 ✓
- Admin (user/token/usage/dokumen) → Task 10/11 ✓
- Portal login sederhana → Task 9 ✓
- Frontend (Login/Playground/Documents/Admin) → Task 12–15 ✓
- Docker compose + volume persisten → Task 16 ✓
- Milestone order sesuai kesepakatan → Task 1–17 ✓

**2. Placeholder scan:** tidak ada TBD/TODO; semua step berisi kode nyata. Stub halaman di Task 12 sengaja minimal dan diganti penuh di Task 13–15 (jelas di langkahnya).

**3. Type consistency:** `tokenAuth` → `req.auth = {tokenId, userId, scope}` konsisten dipakai di `routes/ask.ts`. `loadSession`/`requireLogin`/`requireAdmin` konsisten. `hashToken`/`generateToken` konsisten antara Task 7 dan Task 8/10/11. `chunk_segments` signature konsisten antara Task 4 dan Task 5. `embed_texts` signature konsisten antara Task 2 dan Task 5/8.
