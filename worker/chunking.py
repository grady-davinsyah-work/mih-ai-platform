import re
from dataclasses import dataclass

import tiktoken

from parsers import Segment

_ENC = tiktoken.get_encoding("cl100k_base")
_SENT_SPLIT = re.compile(r"(?<=[.!?。！？])\s+|(?<=\n)\s*")


@dataclass
class Chunk:
    text: str
    page_or_slide: int | None
    section_title: str | None
    chunk_index: int


def token_count(text: str) -> int:
    try:
        return len(_ENC.encode(text))
    except Exception:
        # fallback deterministik tanpa jaringan
        return max(1, len(text) // 4)


def token_tail(text: str, ratio: float = 0.15) -> str:
    toks = _ENC.encode(text)
    n = max(1, int(len(toks) * ratio))
    return _ENC.decode(toks[-n:])


def split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in _SENT_SPLIT.split(text) if p.strip()]
    return parts or ([text] if text.strip() else [])


# min_tokens sengaja lunak; max_tokens adalah batas keras.
def chunk_segments(segments: list[Segment], *, min_tokens: int = 300,
                   max_tokens: int = 800, overlap_ratio: float = 0.15) -> list[Chunk]:
    chunks: list[Chunk] = []
    idx = 0
    for seg in segments:
        tail = ""
        buffer = ""
        for sent in split_sentences(seg.text):
            if buffer:
                candidate = f"{tail} {buffer} {sent}".strip() if tail else f"{buffer} {sent}".strip()
            else:
                candidate = f"{tail} {sent}".strip() if tail else sent
            if token_count(candidate) <= max_tokens:
                buffer = candidate
                continue
            if buffer:
                chunks.append(Chunk(text=buffer, page_or_slide=seg.page_or_slide,
                                    section_title=seg.section_title, chunk_index=idx))
                idx += 1
                tail = token_tail(buffer, overlap_ratio)
                buffer = ""
            cand2 = f"{tail} {sent}".strip() if tail else sent
            if token_count(cand2) <= max_tokens:
                buffer = cand2
                tail = ""
            elif token_count(sent) <= max_tokens:
                # tail + sent melewati batas keras, tapi sent sendiri muat → buang tail
                buffer = sent
                tail = ""
            else:
                # kalimat tunggal melebihi batas keras → simpan apa adanya (fallback terdokumentasi)
                chunks.append(Chunk(text=sent, page_or_slide=seg.page_or_slide,
                                    section_title=seg.section_title, chunk_index=idx))
                idx += 1
                tail = ""
        if buffer:
            chunks.append(Chunk(text=buffer, page_or_slide=seg.page_or_slide,
                                section_title=seg.section_title, chunk_index=idx))
            idx += 1
    return chunks
