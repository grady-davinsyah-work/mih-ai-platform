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
