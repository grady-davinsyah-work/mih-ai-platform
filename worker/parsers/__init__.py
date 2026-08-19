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
