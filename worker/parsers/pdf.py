from pathlib import Path

from .base import Segment


def parse_pdf(path: Path, ocr: bool = False) -> list[Segment]:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    segments: list[Segment] = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text and ocr:
            text = _ocr_page(str(path), i)
        segments.append(Segment(text=text, page_or_slide=i, needs_ocr=not text))
    return segments


def _ocr_page(pdf_path: str, page_no: int) -> str:
    """OCR satu halaman PDF scan via PyMuPDF (render) + pytesseract."""
    import fitz  # PyMuPDF
    import pytesseract

    doc = fitz.open(pdf_path)
    try:
        pix = doc[page_no - 1].get_pixmap(dpi=300)
    finally:
        doc.close()
    img_bytes = pix.tobytes("png")
    # ind+eng: dokumen utama berbahasa Indonesia; eng sebagai pelengkap istilah.
    return pytesseract.image_to_string(img_bytes, lang="ind+eng").strip()
