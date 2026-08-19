import os

from openai import OpenAI

MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
BATCH = 64


def embed_texts(texts: list[str]) -> list[list[float]]:
    client = OpenAI()
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        resp = client.embeddings.create(model=MODEL, input=batch)
        out.extend([d.embedding for d in resp.data])
    return out
