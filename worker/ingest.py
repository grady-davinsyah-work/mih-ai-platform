import argparse
import hashlib
import os
import subprocess
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


def scan_dir(conn, dirpath: str, source: str = "drive") -> int:
    added = 0
    # Scope promosi: hanya baris yang file-nya hidup di folder source ini. Upload
    # manual (/data/uploaded) tidak pernah kena (file_path-nya di luar RAW_DIR).
    prefix = dirpath.rstrip("/") + "/%"
    for path in sorted(Path(dirpath).rglob("*")):
        if not path.is_file():
            continue
        if file_path_ext(path.name) not in SUPPORTED_EXTENSIONS:
            continue
        sha = sha256_file(path)
        if ensure_raw_document(conn, path.name, str(path), sha, classify_file(path.name), source):
            added += 1
        else:
            # sha sudah ada — row lama dari kanal raw (mis. sebelum migrasi) di-promosikan
            # ke source ini agar hapus dari remote ikut menghapusnya.
            conn.execute(
                "UPDATE documents SET source=%s WHERE sha256=%s AND file_path LIKE %s AND source <> %s",
                (source, sha, prefix, source),
            )
    conn.commit()
    return added


def process_document(conn, doc) -> int:
    doc_id = doc["id"]
    set_status(conn, doc_id, "processing")
    path = Path(doc["file_path"])
    if not path.exists():
        raise FileNotFoundError(f"file tidak ditemukan: {path}")
    ocr = os.environ.get("OCR_ENABLED", "1") in ("1", "true", "True")
    segments = parse_document(path, doc["file_extension"], ocr=ocr)
    ocr_pages = [s.page_or_slide for s in segments if s.needs_ocr]
    chunks = chunk_segments(segments)
    if not chunks:
        raise ValueError("tidak ada teks terekstrak — kemungkinan hasil scan, perlu OCR")
    vectors = embed_texts([c.text for c in chunks])
    if len(vectors) != len(chunks):
        raise ValueError(f"jumlah embedding {len(vectors)} != jumlah chunk {len(chunks)}")
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
            conn.rollback()
            set_status(conn, doc["id"], "failed", str(e))
            print(f"fail doc={doc['id']} err={e}")
        conn.commit()
    return done


def _rclone_sync(remote: str, dest: str, label: str) -> bool:
    """Jalankan rclone sync dari remote ke dest. Raise RuntimeError bila gagal."""
    conf = os.environ.get("RCLONE_CONFIG", "")
    if conf and not Path(conf).is_file():
        raise RuntimeError(f"rclone.conf tidak ditemukan: {conf} (jalankan rclone config lalu scp ke server)")
    Path(dest).mkdir(parents=True, exist_ok=True)
    cmd = [
        "rclone", "sync", remote, dest,
        "--include", "*.pdf", "--include", "*.pptx", "--include", "*.docx",
        "--ignore-case",
        "--transfers", "4", "--log-level", "ERROR",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"rclone sync {label} gagal (rc={proc.returncode}): {proc.stderr.strip()}")
    print(f"{label}-sync: ok dari {remote}")
    return True


def drive_sync() -> bool:
    """Sinkronisasi folder Google Drive ke DRIVE_DEST via rclone. Return True bila sinkron."""
    remote = os.environ.get("DRIVE_REMOTE", "")
    if not remote:
        print("DRIVE_REMOTE tidak diset — lewati sinkronisasi Drive")
        return False
    return _rclone_sync(remote, os.environ.get("DRIVE_DEST", "/data/raw/drive"), "drive")


def sharepoint_sync() -> bool:
    """Sinkronisasi library SharePoint (rclone onedrive backend) ke SHAREPOINT_DEST."""
    remote = os.environ.get("SHAREPOINT_REMOTE", "")
    if not remote:
        print("SHAREPOINT_REMOTE tidak diset — lewati sinkronisasi SharePoint")
        return False
    return _rclone_sync(remote, os.environ.get("SHAREPOINT_DEST", "/data/raw/sharepoint"), "sharepoint")


def prune_removed(conn, source: str = "drive") -> int:
    """Hapus dokumen ber-source tertentu yang file-nya tidak lagi ada di disk."""
    rows = conn.execute(
        "SELECT id, file_path FROM documents WHERE source=%s", (source,)
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
    if not os.environ.get("DRIVE_REMOTE"):
        return last_sync
    now = time.time()
    if now - last_sync < interval_min * 60:
        return last_sync
    try:
        if drive_sync():
            scan_dir(conn, os.environ.get("DRIVE_DEST", "/data/raw/drive"))
        prune_removed(conn)
    except Exception as e:
        print("drive-sync error:", e)
    return now


def maybe_sharepoint_sync(conn, last_sync: float, interval_min: int) -> float:
    """Sync SharePoint bila interval terlampaui; hapus dokumen yang file-nya hilang."""
    if not os.environ.get("SHAREPOINT_REMOTE"):
        return last_sync
    now = time.time()
    if now - last_sync < interval_min * 60:
        return last_sync
    try:
        if sharepoint_sync():
            scan_dir(conn, os.environ.get("SHAREPOINT_DEST", "/data/raw/sharepoint"), "sharepoint")
        prune_removed(conn, "sharepoint")
    except Exception as e:
        print("sharepoint-sync error:", e)
    return now


def watch():
    conn = connect()
    raw_dir = os.environ.get("RAW_DIR", "/data/raw")
    drive_dest = os.environ.get("DRIVE_DEST", "/data/raw/drive")
    sp_dest = os.environ.get("SHAREPOINT_DEST", "/data/raw/sharepoint")
    interval = int(os.environ.get("INGEST_INTERVAL_SEC", "30"))
    sync_interval_min = int(os.environ.get("DRIVE_SYNC_INTERVAL_MIN", "15"))
    Path(raw_dir).mkdir(parents=True, exist_ok=True)
    Path(drive_dest).mkdir(parents=True, exist_ok=True)
    Path(sp_dest).mkdir(parents=True, exist_ok=True)
    print(f"watch aktif: {raw_dir} setiap {interval}s, drive-sync tiap {sync_interval_min}m")
    last_sync = 0.0
    last_sp_sync = 0.0
    while True:
        try:
            last_sync = maybe_drive_sync(conn, last_sync, sync_interval_min)
            last_sp_sync = maybe_sharepoint_sync(conn, last_sp_sync, sync_interval_min)
            added = scan_dir(conn, drive_dest)
            added += scan_dir(conn, sp_dest, "sharepoint")
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
    s.add_argument("--source", default="drive", choices=["drive", "sharepoint", "upload"])
    sub.add_parser("watch")
    sub.add_parser("drive-sync")
    sub.add_parser("sharepoint-sync")
    args = parser.parse_args()

    conn = connect()
    if args.cmd == "scan":
        n = scan_dir(conn, args.dir, args.source)
        process_pending(conn)
        print(f"siap: {n} dokumen baru diantrekan")
    elif args.cmd == "watch":
        watch()
    elif args.cmd == "drive-sync":
        if drive_sync():
            n = scan_dir(conn, os.environ.get("DRIVE_DEST", "/data/raw/drive"))
            print(f"drive-sync: {n} dokumen baru diantrekan")
            process_pending(conn)
        pruned = prune_removed(conn)
        if pruned:
            print(f"drive-sync: {pruned} dokumen terprune")
    elif args.cmd == "sharepoint-sync":
        if sharepoint_sync():
            n = scan_dir(conn, os.environ.get("SHAREPOINT_DEST", "/data/raw/sharepoint"), "sharepoint")
            print(f"sharepoint-sync: {n} dokumen baru diantrekan")
            process_pending(conn)
        pruned = prune_removed(conn, "sharepoint")
        if pruned:
            print(f"sharepoint-sync: {pruned} dokumen terprune")


if __name__ == "__main__":
    main()
