import time
from types import SimpleNamespace

from ingest import scan_dir
from db import ensure_raw_document
import ingest


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


def test_drive_sync_panggil_rclone(monkeypatch, tmp_path):
    calls = []

    def fake_run(cmd, **kw):
        calls.append(cmd)
        return SimpleNamespace(returncode=0, stderr="")

    monkeypatch.setattr(ingest.subprocess, "run", fake_run)
    monkeypatch.setenv("DRIVE_REMOTE", "gdrive:folder-rag")
    monkeypatch.setenv("DRIVE_DEST", str(tmp_path))
    monkeypatch.delenv("RCLONE_CONFIG", raising=False)
    assert ingest.drive_sync() is True
    cmd = calls[0]
    assert cmd[0] == "rclone" and cmd[1] == "sync"
    assert "gdrive:folder-rag" in cmd
    assert str(tmp_path) in cmd
    assert "--include" in cmd
    assert "*.pdf" in cmd and "*.pptx" in cmd and "*.docx" in cmd
    assert "--ignore-case" in cmd


def test_drive_sync_lewati_jika_env_kosong(monkeypatch):
    monkeypatch.delenv("DRIVE_REMOTE", raising=False)
    assert ingest.drive_sync() is False


def test_drive_sync_raise_saat_rclone_gagal(monkeypatch, tmp_path):
    monkeypatch.setattr(
        ingest.subprocess, "run",
        lambda cmd, **kw: SimpleNamespace(returncode=1, stderr="permission denied"),
    )
    monkeypatch.setenv("DRIVE_REMOTE", "gdrive:x")
    monkeypatch.setenv("DRIVE_DEST", str(tmp_path))
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
    sql, params = conn.calls[0]  # SELECT hanya row source=drive
    assert "source=%s" in sql and params[0] == "drive"
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
