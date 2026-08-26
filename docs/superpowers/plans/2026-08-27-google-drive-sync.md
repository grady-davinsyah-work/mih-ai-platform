# Google Drive Sync (rclone) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sinkronkan folder Google Drive (berisi file RAG pdf/pptx/docx) ke `/data/raw` worker, dengan hapus file dari Drive ikut menghapus dokumen dari RAG.

**Architecture:** rclone diinstall di image worker. Worker `watch()` menjalankan `drive_sync()` (rclone sync ke `/data/raw`) pada interval sendiri (`DRIVE_SYNC_INTERVAL_MIN`, default 15) lalu `prune_removed()` yang menghapus row `documents` ber-`source='drive'` yang `file_path`-nya tidak lagi ada di disk. Kolom `source` membedakan asal file (upload manual vs Drive); prune hanya menyentuh `source='drive'`. `scan_dir` (kanal `/data/raw`) meng-insert dokumen dengan `source='drive'`.

**Tech Stack:** Python 3.12, psycopg, pytest, rclone (apt di image), Docker Compose (dev: `./data:/data` bind; prod: volume `appdata`).

**Spec:** `docs/superpowers/specs/2026-08-27-drive-sync-and-chat-history-design.md` (bagian A)

## Global Constraints

- Worker base `python:3.12-slim` (Debian) — rclone tersedia via `apt-get install rclone`.
- `connect()` membaca `DATABASE_URL`; worker test TIDAK pakai DB nyata — uji fungsi murni / fungsi yang memakai objek `conn` fiktif (fake connection) dengan `SimpleNamespace`/kelas kecil di file test.
- `ensure_raw_document` signature sekarang `(conn, filename, file_path, sha256, file_type)` — perlu parameter `source` baru; semua pemanggil di-update.
- `PRUNE` hanya `source='drive'` — row upload manual (`/data/uploaded`) tidak pernah kena.
- `drive_sync()` tidak boleh crash `watch()` saat `DRIVE_REMOTE` kosong (lewati diam-diam) — env opsional.
- rclone.conf TIDAK di-git (rahasia, berisi token OAuth). Env `RCLONE_CONFIG` menunjuk ke file di volume `/data` (visible lintas recreate di dev karena bind `./data`; di prod perlu bind-mount tambahan).
- `db/init.sql` tidak live di container berjalan (lihat memory `content-system-deploy`) — migrasi `source` dijalankan manual via psql saat deploy (Task 4), dan ditambahkan ke `init.sql` untuk DB baru.

---

### Task 1: Kolom `source` + penandaan asal dokumen

**Files:**
- Modify: `db/init.sql` (tambah ALTER + index)
- Modify: `worker/db.py:19-31` (`ensure_raw_document` + param `source`)
- Modify: `worker/ingest.py:32-43` (`scan_dir` kirim `"drive"`)
- Test: `worker/tests/test_drive_sync.py` (baru)

**Interfaces:**
- Consumes: `ensure_raw_document`, `scan_dir`, `file_path_ext`, `SUPPORTED_EXTENSIONS` (sudah ada di `db.py`/`ingest.py`).
- Produces:
  - `ensure_raw_document(conn, filename, file_path, sha256, file_type, source="upload") -> bool` — insert menyertakan kolom `source`.
  - `scan_dir(conn, dirpath)` — memanggil `ensure_raw_document(..., "drive")` (kolom source berisi `'drive'`).
  - Tabel `documents` punya kolom `source TEXT NOT NULL DEFAULT 'upload'`.

- [ ] **Step 1: Tulis test yang gagal** — `worker/tests/test_drive_sync.py`

```python
from types import SimpleNamespace

from ingest import scan_dir
from db import ensure_raw_document


class FakeConn:
    """conn fiktif: execute() return objek dengan fetchone()/fetchall() yang bisa diskenario."""

    def __init__(self, fetchall_result=None):
        self.calls = []
        self._fetchall_result = fetchall_result or []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        result = SimpleNamespace(fetchone=lambda: None, fetchall=lambda: self._fetchall_result)
        return result

    def commit(self):
        pass


def test_ensure_raw_document_menyertakan_source():
    conn = FakeConn()
    ok = ensure_raw_document(conn, "x.pdf", "/data/raw/x.pdf", "abc123", "laporan", "drive")
    assert ok is True
    sql, params = conn.calls[1]  # [1] = INSERT; [0] = SELECT cek sha256
    assert "source" in sql
    assert params[-1] == "drive"


def test_ensure_raw_document_default_upload():
    conn = FakeConn()
    ensure_raw_document(conn, "x.pdf", "/data/raw/x.pdf", "abc123", "laporan")
    sql, params = conn.calls[1]
    assert params[-1] == "upload"


def test_scan_dir_mark_drive_source(tmp_path):
    (tmp_path / "a.pdf").write_bytes(b"abc")
    (tmp_path / "b.txt").write_bytes(b"abc")  # ekstensi tidak didukung -> dilewati
    conn = FakeConn()
    n = scan_dir(conn, str(tmp_path))
    assert n == 1
    inserts = [c for c in conn.calls if c[0].startswith("INSERT INTO documents")]
    assert inserts[0][1][-1] == "drive"
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd worker && python -m pytest tests/test_drive_sync.py -v`
Expected: FAIL — `ensure_raw_document` menolak argumen `source` (TypeError) / kolom `source` tidak di SQL.

- [ ] **Step 3: Schema** — `db/init.sql` tambah di akhir file:

```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload';
CREATE INDEX IF NOT EXISTS documents_source_idx ON documents (source);
```

- [ ] **Step 4: Update `ensure_raw_document`** — `worker/db.py`:

```python
def ensure_raw_document(conn, filename: str, file_path: str, sha256: str, file_type: str, source: str = "upload") -> bool:
    """Insert dokumen pending jika hash belum ada. Return True jika baru."""
    if file_path_ext(filename) not in SUPPORTED_EXTENSIONS:
        return False
    exists = conn.execute("SELECT 1 FROM documents WHERE sha256=%s", (sha256,)).fetchone()
    if exists:
        return False
    conn.execute(
        "INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status, source) "
        "VALUES (%s, %s, %s, %s, %s, 'pending', %s)",
        (filename, file_type, file_path_ext(filename), sha256, file_path, source),
    )
    return True
```

- [ ] **Step 5: Update `scan_dir`** — `worker/ingest.py`:

```python
        if ensure_raw_document(conn, path.name, str(path), sha, classify_file(path.name), "drive"):
            added += 1
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `cd worker && python -m pytest tests/test_drive_sync.py tests/test_ingest.py -v`
Expected: PASS (semua).

- [ ] **Step 7: Commit**

```bash
git add db/init.sql worker/db.py worker/ingest.py worker/tests/test_drive_sync.py
git commit -m "feat(worker): kolom documents.source + penandaan file dari /data/raw sebagai drive"
```

---

### Task 2: `drive_sync()`, `prune_removed()`, subcommand, interval di watch

**Files:**
- Modify: `worker/ingest.py` (import `subprocess`; tambah `drive_sync`, `prune_removed`, `maybe_drive_sync`; update `watch()`; tambah subcommand `drive-sync`)
- Test: `worker/tests/test_drive_sync.py` (tambah)

**Interfaces:**
- Consumes: env `DRIVE_REMOTE`, `RAW_DIR`, `DRIVE_SYNC_INTERVAL_MIN`; `connect()`, `scan_dir`, `process_pending` dari Task 1; `conn` psycopg (fetchall row dict).
- Produces:
  - `drive_sync() -> bool` — subprocess `rclone sync`; return `False` (tanpa error) bila `DRIVE_REMOTE` kosong; raise `RuntimeError` bila rclone rc≠0.
  - `prune_removed(conn) -> int` — hapus row `source='drive'` yang `file_path` tidak ada di disk; return jumlah terhapus; commit bila ada yang dihapus.
  - `maybe_drive_sync(conn, last_sync: float, interval_min: int) -> float` — jalankan `drive_sync()` + `scan_dir` + `prune_removed` bila `now - last_sync >= interval_min*60`; return `last_sync` baru.
  - `watch()` — menyimpan `last_sync` di loop; `maybe_drive_sync` dipanggil tiap iterasi (interval sendiri).
  - Subcommand `ingest.py drive-sync` — sync manual + scan + process + prune (sinkronisasi pertama).

- [ ] **Step 1: Tulis test yang gagal** — tambah ke `worker/tests/test_drive_sync.py`

```python
import time

import ingest


def test_drive_sync_panggil_rclone(monkeypatch):
    calls = []

    def fake_run(cmd, **kw):
        calls.append(cmd)
        return SimpleNamespace(returncode=0, stderr="")

    monkeypatch.setattr(ingest.subprocess, "run", fake_run)
    monkeypatch.setenv("DRIVE_REMOTE", "gdrive:folder-rag")
    assert ingest.drive_sync() is True
    cmd = calls[0]
    assert cmd[0] == "rclone" and cmd[1] == "sync"
    assert "gdrive:folder-rag" in cmd
    assert "/data/raw" in cmd
    assert "--include" in cmd
    assert "*.pdf" in cmd and "*.pptx" in cmd and "*.docx" in cmd


def test_drive_sync_lewati_jika_env_kosong(monkeypatch):
    monkeypatch.delenv("DRIVE_REMOTE", raising=False)
    assert ingest.drive_sync() is False


def test_drive_sync_raise_saat_rclone_gagal(monkeypatch):
    monkeypatch.setattr(
        ingest.subprocess, "run",
        lambda cmd, **kw: SimpleNamespace(returncode=1, stderr="permission denied"),
    )
    monkeypatch.setenv("DRIVE_REMOTE", "gdrive:x")
    import pytest
    with pytest.raises(RuntimeError):
        ingest.drive_sync()


def test_prune_removed_hapus_hanya_file_hilang(tmp_path):
    ada = tmp_path / "ada.pdf"
    ada.write_bytes(b"x")
    conn = FakeConn([
        {"id": 1, "file_path": str(ada)},
        {"id": 2, "file_path": str(tmp_path / "hilang.pdf")},
    ])
    n = ingest.prune_removed(conn)
    assert n == 1
    deletes = [c for c in conn.calls if c[0].startswith("DELETE FROM documents")]
    assert deletes[0][1] == (2,)


def test_maybe_drive_sync_interval_belum_lewat(monkeypatch):
    ran = {"drive": 0}
    monkeypatch.setenv("DRIVE_REMOTE", "gdrive:x")
    monkeypatch.setattr(ingest, "drive_sync", lambda: (ran.__setitem__("drive", ran["drive"] + 1) or True))
    monkeypatch.setattr(ingest, "prune_removed", lambda conn: 0)
    monkeypatch.setattr(ingest, "scan_dir", lambda conn, d: 0)
    last = ingest.maybe_drive_sync(object(), time.time(), 15)
    assert ran["drive"] == 0  # masih dalam interval -> lewati


def test_maybe_drive_sync_interval_lewat(monkeypatch):
    ran = {"drive": 0, "prune": 0}
    monkeypatch.setenv("DRIVE_REMOTE", "gdrive:x")
    monkeypatch.setattr(ingest, "drive_sync", lambda: (ran.__setitem__("drive", ran["drive"] + 1) or True))
    monkeypatch.setattr(ingest, "prune_removed", lambda conn: (ran.__setitem__("prune", ran["prune"] + 1) or 0))
    monkeypatch.setattr(ingest, "scan_dir", lambda conn, d: 0)
    last = ingest.maybe_drive_sync(object(), 0, 0)  # interval 0 -> selalu sync
    assert ran["drive"] == 1 and ran["prune"] == 1
    ingest.maybe_drive_sync(object(), last, 0)
    assert ran["drive"] == 2
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd worker && python -m pytest tests/test_drive_sync.py -v`
Expected: FAIL — `ingest.drive_sync` / `prune_removed` / `maybe_drive_sync` belum ada (AttributeError).

- [ ] **Step 3: Implementasi di `worker/ingest.py`**

Tambah import di baris atas:

```python
import subprocess
```

Tambah fungsi setelah `process_pending` (sebelum `watch`):

```python
def drive_sync() -> bool:
    """Sinkronisasi folder Google Drive ke /data/raw via rclone. Return True bila sinkron."""
    remote = os.environ.get("DRIVE_REMOTE", "")
    if not remote:
        print("DRIVE_REMOTE tidak diset — lewati sinkronisasi Drive")
        return False
    dest = os.environ.get("RAW_DIR", "/data/raw")
    cmd = [
        "rclone", "sync", remote, dest,
        "--include", "*.pdf", "--include", "*.pptx", "--include", "*.docx",
        "--transfers", "4", "--log-level", "ERROR",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"rclone sync gagal (rc={proc.returncode}): {proc.stderr.strip()}")
    print(f"drive-sync: ok dari {remote}")
    return True


def prune_removed(conn) -> int:
    """Hapus dokumen source='drive' yang file-nya tidak lagi ada di disk. Return jumlah terhapus."""
    rows = conn.execute(
        "SELECT id, file_path FROM documents WHERE source='drive'"
    ).fetchall()
    removed = 0
    for r in rows:
        if not Path(r["file_path"]).exists():
            conn.execute("DELETE FROM documents WHERE id=%s", (r["id"],))
            removed += 1
    if removed:
        conn.commit()
    return removed


def maybe_drive_sync(conn, last_sync: float, interval_min: int) -> float:
    """Sync Drive bila interval terlampaui; hapus dokumen yang file-nya hilang."""
    now = time.time()
    if now - last_sync < interval_min * 60:
        return last_sync
    try:
        if drive_sync():
            scan_dir(conn, os.environ.get("RAW_DIR", "/data/raw"))
        prune_removed(conn)
    except Exception as e:
        print("drive-sync error:", e)
    return now
```

Update `watch()`:

```python
def watch():
    conn = connect()
    raw_dir = os.environ.get("RAW_DIR", "/data/raw")
    interval = int(os.environ.get("INGEST_INTERVAL_SEC", "30"))
    sync_interval_min = int(os.environ.get("DRIVE_SYNC_INTERVAL_MIN", "15"))
    Path(raw_dir).mkdir(parents=True, exist_ok=True)
    print(f"watch aktif: {raw_dir} setiap {interval}s, drive-sync tiap {sync_interval_min}m")
    last_sync = 0.0
    while True:
        try:
            last_sync = maybe_drive_sync(conn, last_sync, sync_interval_min)
            added = scan_dir(conn, raw_dir)
            if added:
                print(f"scan: {added} dokumen baru diantrekan")
            process_pending(conn)
        except Exception as e:
            print("watch error:", e)
        time.sleep(interval)
```

Update `main()` — tambah subcommand:

```python
    sub.add_parser("drive-sync")
```

dan di cabang `if`:

```python
    elif args.cmd == "drive-sync":
        if drive_sync():
            n = scan_dir(conn, os.environ.get("RAW_DIR", "/data/raw"))
            print(f"drive-sync: {n} dokumen baru diantrekan")
            process_pending(conn)
        pruned = prune_removed(conn)
        if pruned:
            print(f"drive-sync: {pruned} dokumen terprune")
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd worker && python -m pytest tests/ -v`
Expected: PASS (test_ingest.py + test_drive_sync.py).

- [ ] **Step 5: Commit**

```bash
git add worker/ingest.py worker/tests/test_drive_sync.py
git commit -m "feat(worker): sync Google Drive via rclone + prune dokumen source=drive"
```

---

### Task 3: Install rclone di image + env & mount

**Files:**
- Modify: `worker/Dockerfile` (install rclone)
- Modify: `.env.example` (tambah 3 var Drive)
- Modify: `.env.example.prod` (tambah 3 var Drive)
- Modify: `docker-compose.prod.yml` (mount rclone.conf ke worker)

**Interfaces:**
- Consumes: env `DRIVE_REMOTE`, `DRIVE_SYNC_INTERVAL_MIN`, `RCLONE_CONFIG` dari env file; `drive_sync()`/`maybe_drive_sync()` dari Task 2.
- Produces:
  - Image worker punya biner `rclone` (verifikasi: `docker compose build worker` lalu `docker compose run --rm worker rclone version`).
  - Container worker melihat rclone.conf di `/data/rclone/rclone.conf` (dev: via bind `./data:/data` yang sudah ada; prod: via mount file tambahan).
  - Env template berisi var Drive (nilai kosong — aman, `drive_sync()` lewati bila `DRIVE_REMOTE` kosong).

- [ ] **Step 1: Install rclone di Dockerfile** — `worker/Dockerfile`, tambah setelah blok `RUN pip install ...` (baris 9-10), sebelum `COPY . .`:

```dockerfile
# rclone untuk sinkronisasi Google Drive. Base python:3.12-slim (Debian) punya
# paket rclone di repo resmi.
RUN apt-get update && apt-get install -y --no-install-recommends rclone && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Env templates** — `.env.example` dan `.env.example.prod`, tambah di bagian `# Data & ingestion`:

```
# --- Google Drive sync (OPSIONAL; kosong = nonaktif) ---------------------------
# DRIVE_REMOTE=rclone remote + path folder, mis. gdrive:folder-rag
DRIVE_REMOTE=
DRIVE_SYNC_INTERVAL_MIN=15
RCLONE_CONFIG=/data/rclone/rclone.conf
```

- [ ] **Step 3: Mount rclone.conf di prod** — `docker-compose.prod.yml`, section `worker` volumes:

```yaml
    volumes:
      - appdata:/data
      - ./data/rclone/rclone.conf:/data/rclone/rclone.conf:ro
```

Catatan: dev/keuanganpmp TIDAK perlu mount tambahan — volume `./data:/data` (bind) sudah membuat `data/rclone/rclone.conf` di host terlihat di `/data/rclone/rclone.conf`.

- [ ] **Step 4: Verifikasi build image**

Run: `cd <repo> && docker compose build worker` (dev) — lalu `docker compose run --rm worker rclone version`.
Expected: output versi rclone (bukan `executable file not found`).

- [ ] **Step 5: Commit**

```bash
git add worker/Dockerfile .env.example .env.example.prod docker-compose.prod.yml
git commit -m "feat(worker): install rclone + env DRIVE_* dan mount rclone.conf prod"
```

---

### Task 4: Migrasi & deploy (manual — dua server)

> Task ini jalannya saat deploy, bukan di development. Semua perintah dijalankan oleh engineer di kedua server (VPS `root@202.155.16.55` dan keuanganpmp `root@100.102.56.69`).

- [ ] **Step 1: Migrasi DB (kedua server)** — tambah kolom `source` ke DB yang sudah hidup (pola psql manual, lihat memory `content-system-deploy`):

```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload';
CREATE INDEX IF NOT EXISTS documents_source_idx ON documents (source);
```

VPS: `docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db psql -U ${POSTGRES_USER:-mih} -d ${POSTGRES_DB:-mih} -c "..."` (ganti `-c` per statement, atau heredoc).
keuanganpmp: `docker compose exec -T db psql -U mih -d mih` + jalankan SQL inline.

- [ ] **Step 2: Setup rclone.conf (sekali, partisipasi user)** — bukan di sini; dikomunikasikan ke user:

```
rclone config          # di PC user -> remote "gdrive" -> login akun pemilik folder
# lalu salin rclone.conf ke server:
scp rclone.conf root@<server>:/root/mih/data/rclone/rclone.conf   # dev/keuanganpmp
scp rclone.conf root@<server>:/root/mih/data/rclone/rclone.conf   # VPS (folder data dir-jadikan host)
mkdir -p <repo>/data/rclone   # pastikan ada sebelum up (mount file)
```

Set `DRIVE_REMOTE=gdrive:<folder>` di `.env.prod` (VPS) dan `.env` (keuanganpmp).

- [ ] **Step 3: Deploy + rebuild** — kedua server, deploy normal (VPS `scripts/deploy-prod.sh`; keuanganpmp pola compose default + proxy). Pastikan worker rebuild karena Dockerfile berubah.

- [ ] **Step 4: Sinkronisasi pertama (manual)** — verifikasi kanal Drive:

```bash
docker compose ... exec worker python ingest.py drive-sync
# lalu cek dokumen masuk:
docker compose ... exec db psql -U mih -d mih -c "SELECT id, filename, source, status FROM documents ORDER BY id DESC LIMIT 10;"
```

Expected: file Drive muncul dengan `source='drive'`, status `completed`.

- [ ] **Step 5: Uji hapus** — hapus satu file di folder Drive, jalankan `drive-sync` lagi, cek row dokumen itu hilang dari `documents` (dan chunks ter-cascade).

- [ ] **Step 6: Uji interval** — pastikan env `DRIVE_SYNC_INTERVAL_MIN` terpasang; `docker compose logs -f worker` menampilkan `drive-sync: ok dari ...` saat interval terlewati.

- [ ] **Step 7: Commit** — tidak ada (task deploy tidak mengubah file repo).
