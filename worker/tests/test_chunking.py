from chunking import chunk_segments, token_count, split_sentences, token_tail
from parsers import Segment


def test_split_sentences_basic():
    text = "Kalimat pertama. Kalimat kedua! Kalimat ketiga?"
    assert split_sentences(text) == ["Kalimat pertama.", "Kalimat kedua!", "Kalimat ketiga?"]


def test_chunk_size_within_max():
    seg = Segment(text=" ".join(["Ini adalah kalimat pengisi untuk menguji chunking dokumen kedeputian."] * 200),
                  page_or_slide=1, section_title="Bab 1")
    chunks = chunk_segments([seg])
    assert chunks, "harus menghasilkan minimal satu chunk"
    for c in chunks:
        assert token_count(c.text) <= 800, f"chunk {c.chunk_index} melebihi 800 token"


def test_chunk_metadata_present():
    seg = Segment(text=" ".join(["Kata kata pengisi untuk menguji metadata chunk."] * 80),
                  page_or_slide=3, section_title="Sub-bab A")
    chunks = chunk_segments([seg])
    assert len(chunks) >= 1
    for c in chunks:
        assert c.page_or_slide == 3
        assert c.section_title == "Sub-bab A"


def test_overlap_between_consecutive_chunks():
    seg = Segment(text=" ".join(["Kata kata pengisi yang cukup panjang agar terpecah menjadi beberapa chunk."] * 150),
                  page_or_slide=1, section_title="x")
    chunks = chunk_segments([seg])
    assert len(chunks) >= 2
    for a, b in zip(chunks, chunks[1:]):
        tail = token_tail(a.text, 0.15)
        assert tail in b.text, "overlap antar chunk tidak ditemukan"


def test_chunk_indices_sequential():
    seg = Segment(text=" ".join(["Kata kata pengisi untuk urutan chunk."] * 120),
                  page_or_slide=2, section_title="y")
    chunks = chunk_segments([seg])
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))
