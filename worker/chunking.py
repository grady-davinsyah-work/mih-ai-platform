def chunk_segments(segments, *, min_tokens=300, max_tokens=800, overlap_ratio=0.15) -> list:
    return []


def token_count(t) -> int:
    return max(1, len(t) // 4)
