"""Configuration for the Ganit Siksha ingestion pipeline."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ── Book identity ─────────────────────────────────────────────────────────
BOOK_ID = "c7"
BOOK_TITLE = "গণিতপ্রভা"
CLASS_NAME = "সপ্তম শ্রেণি"

# ── Calibrated to THIS pdf. Re-measure before reusing for another book. ───
PAGE_OFFSET = 10           # printed_page = pdf_index - PAGE_OFFSET
FRONT_MATTER_END = 11
BACK_MATTER_START = 283
EXPECTED_CHAPTERS = 23
EXPECTED_PAGES = 298

# ── Work dirs (Cloud Run task local disk; nothing persists between runs) ──
WORK = Path(os.getenv("WORK_DIR", "./_work"))
PDF_PATH = Path(os.getenv("PDF_PATH", WORK / "class_VII.pdf"))
PAGES_DIR = WORK / "pages"
BLOCK_DIR = WORK / "blocks"
FIG_DIR = WORK / "figures"
DIST = WORK / "dist"

RENDER_DPI = int(os.getenv("RENDER_DPI", "200"))

# ── Providers ─────────────────────────────────────────────────────────────
# Vision: Anthropic. Default to the most capable model; override per run.
EXTRACT_PROVIDER = os.getenv("EXTRACT_PROVIDER", "gemini")   # anthropic | gemini
EXTRACT_MODEL = os.getenv("EXTRACT_MODEL", "claude-opus-5")
GEMINI_EXTRACT_MODEL = os.getenv("GEMINI_EXTRACT_MODEL", "gemini-2.5-flash")
EXTRACT_MAX_TOKENS = int(os.getenv("EXTRACT_MAX_TOKENS", "8000"))
EXTRACT_WORKERS = int(os.getenv("EXTRACT_WORKERS", "4"))
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Embeddings: Gemini (multilingual; Anthropic has no embeddings endpoint).
EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))
EMBED_BATCH = int(os.getenv("EMBED_BATCH", "50"))
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

for _d in (PAGES_DIR, BLOCK_DIR, FIG_DIR, DIST):
    _d.mkdir(parents=True, exist_ok=True)
