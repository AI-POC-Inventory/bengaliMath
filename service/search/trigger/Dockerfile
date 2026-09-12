FROM python:3.11-slim
WORKDIR /app
COPY trigger/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY trigger/main.py ./trigger/
COPY ingest/gcs_paths.py ./ingest/
ENV PORT=8080
EXPOSE 8080
# 1 worker, short timeout: this service only ever starts a job and returns.
CMD exec gunicorn --bind "0.0.0.0:${PORT}" --workers 1 --threads 4 --timeout 30 trigger.main:app
