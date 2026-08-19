def test_imports_and_constants():
    from parsers import Segment
    from db import connect, SUPPORTED_EXTENSIONS
    from embedding import embed_texts
    from chunking import chunk_segments, token_count

    assert "pptx" in SUPPORTED_EXTENSIONS
    assert "pdf" in SUPPORTED_EXTENSIONS
    assert "docx" in SUPPORTED_EXTENSIONS
    assert callable(embed_texts)
    assert callable(connect)
    assert callable(chunk_segments)
    assert callable(token_count)
    s = Segment(text="halo")
    assert s.page_or_slide is None
