FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY serve/ ./
COPY ingest/normalize.py ingest/embed.py ingest/config.py ./

# The index bundle ships in the image: no GCS call on the startup path, and
# each revision pins code and index together (~12 MB of vectors).
COPY _work/dist/ ./index/

ENV PORT=8080 INDEX_DIR=/app/index PYTHONUNBUFFERED=1
EXPOSE 8080

# --preload loads the index in the parent before forking threads.
CMD exec gunicorn --bind "0.0.0.0:${PORT}" --workers 1 --threads 8 \
    --timeout 60 --preload api:app
