FROM python:3.11-slim

WORKDIR /app

# ffmpeg: muxes the rendered slide PNGs + narration WAV into the final MP4
# (render.py). fonts-noto-core: gives Pillow real Bengali glyphs (installs to
# /usr/share/fonts/truetype/noto/NotoSansBengali-{Regular,Bold}.ttf, confirmed
# via `dpkg -L` -- there is no standalone fonts-noto-bengali package on Debian
# trixie). fonts-dejavu-core: NotoSansBengali's cmap does NOT cover superscript
# digits/°/≈/√/π/∞ (confirmed directly, not assumed -- see slides.py's module
# docstring), so slides.py falls back to DejaVuSans per character run for
# whatever NotoSansBengali is missing. Without either font installed,
# slides.py raises NoBengaliFontError rather than producing tofu boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg fonts-noto-core fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# No .env — Supabase/GCP credentials come from Cloud Run Job env vars/secrets.
COPY entrypoint.py script_builder.py slides.py tts.py render.py supabase_client.py ./

ENV PYTHONUNBUFFERED=1

CMD ["python", "entrypoint.py"]
