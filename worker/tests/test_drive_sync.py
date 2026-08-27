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
