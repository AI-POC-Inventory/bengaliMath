FROM python:3.11-slim

WORKDIR /app

# ffmpeg: muxes the rendered slide PNGs + narration WAV into the final MP4
# (render.py). fonts-noto-bengali: gives Pillow real Bengali glyphs to render
# slide text with -- without it, slides.py raises NoBengaliFontError rather
# than silently producing tofu boxes (see slides.py's font search order).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg fonts-noto-bengali \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# No .env — Supabase/GCP credentials come from Cloud Run Job env vars/secrets.
COPY entrypoint.py script_builder.py slides.py tts.py render.py supabase_client.py ./

ENV PYTHONUNBUFFERED=1

CMD ["python", "entrypoint.py"]
