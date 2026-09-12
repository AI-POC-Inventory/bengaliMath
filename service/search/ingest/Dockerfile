FROM python:3.11-slim
WORKDIR /app

COPY ingest/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ingest/ ./

# Task-local scratch; nothing here persists between runs.
ENV WORK_DIR=/tmp/_work PYTHONUNBUFFERED=1

CMD ["python", "job_entrypoint.py"]
