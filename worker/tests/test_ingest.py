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
