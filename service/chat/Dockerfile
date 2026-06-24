FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (no .env — secrets come from Cloud Run env vars)
COPY api.py supabase_client.py gemini_client.py ./

# Cloud Run injects PORT; default to 8080
ENV PORT=8080

EXPOSE 8080

# gthread workers stream SSE responses without buffering; long timeout for chat streams
CMD exec gunicorn --bind "0.0.0.0:${PORT}" --workers 1 --threads 8 --timeout 120 api:app
