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
        "WHERE status='pending' ORDER BY id LIMIT %s FOR UPDATE SKIP LOCKED",
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
