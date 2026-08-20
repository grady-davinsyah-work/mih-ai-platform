FROM python:3.12-slim
WORKDIR /app
# BPE tiktoken dicache offline: proxy korporat tidak stabil ke host Azure blob,
# jadi warm-up get_encoding() tidak boleh men-download saat build/runtime.
ENV TIKTOKEN_CACHE_DIR=/app/tiktoken_cache
COPY requirements.txt ./
COPY tiktoken_cache/ /app/tiktoken_cache/
RUN pip install --no-cache-dir -r requirements.txt \
 && python -c "import tiktoken; tiktoken.get_encoding('cl100k_base')"
COPY . .
CMD ["python", "ingest.py", "watch"]
