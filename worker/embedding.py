import os
import time

from openai import OpenAI

MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
BATCH = 64
MAX_RETRIES = 3
RETRY_DELAY_SEC = 5


def embed_texts(texts: list[str]) -> list[list[float]]:
    client = OpenAI()
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        last_err = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resp = client.embeddings.create(model=MODEL, input=batch)
                out.extend([d.embedding for d in resp.data])
                break
            except Exception as e:
                last_err = e
                if attempt < MAX_RETRIES:
                    wait = RETRY_DELAY_SEC * attempt  # 5s, 10s, 15s
                    print(f"embed retry {attempt}/{MAX_RETRIES} in {wait}s: {e}")
                    time.sleep(wait)
        else:
            raise last_err
    return out
