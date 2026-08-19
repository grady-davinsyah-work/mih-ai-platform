from dataclasses import dataclass


@dataclass
class Segment:
    text: str
    page_or_slide: int | None = None
    section_title: str | None = None
    needs_ocr: bool = False
