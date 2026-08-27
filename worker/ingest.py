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
        if ensure_raw_document(conn, path.name, str(path), sha, classify_file(path.name), "drive"):
            added += 1
    conn.commit()
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
