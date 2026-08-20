FROM python:3.12-slim
WORKDIR /app
# BPE tiktoken dicache offline: proxy korporat tidak stabil ke host Azure blob,
# jadi warm-up get_encoding() tidak boleh men-download saat build/runtime.
ENV TIKTOKEN_CACHE_DIR=/app/tiktoken_cache
COPY requirements.txt ./
COPY tiktoken_cache/ /app/tiktoken_cache/
# timeout/retries: proxy korporat kadang reset koneksi saat unduh wheel.
RUN pip install --no-cache-dir --timeout 60 --retries 5 -r requirements.txt \
 && python -c "import tiktoken; tiktoken.get_encoding('cl100k_base')"
COPY . .
# -u: unbuffered stdout — kalau tidak, print() tersangkut di buffer pipe
# container (8KB) dan log worker tampak kosong sampai buffer penuh.
CMD ["python", "-u", "ingest.py", "watch"]
