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
