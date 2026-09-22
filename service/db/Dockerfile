FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (no .env — secrets come from Cloud Run env vars)
COPY api.py curriculam_reader.py db_helper.py supabase_client.py embed.py question_generator.py ./

# Cloud Run injects PORT; default to 8080
ENV PORT=8080

EXPOSE 8080

# Use gunicorn for production; 1 worker is fine for Cloud Run's concurrency model.
# --timeout 300: question generation for a full 100-question batch can run
# ~8 sequential Gemini calls plus embedding/search calls, comfortably past the
# previous 60s default. Must stay <= the Cloud Run service's own request
# timeout (also set to 300s at deploy) or Cloud Run kills the request first.
CMD exec gunicorn --bind "0.0.0.0:${PORT}" --workers 1 --threads 8 --timeout 300 api:app
