"""Test setup: make ingest/ and serve/ importable, keep scratch out of the repo.

These tests are deliberately offline -- no API keys, no GCS, no PDF. They cover
the pure logic where this project has already been bitten: Bengali Unicode
normalisation, the running-head filter, query filter parsing, and rank fusion.
"""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# config.py creates its work directories at import time; point them at a
# temp dir so running tests never writes into the repo.
os.environ.setdefault("WORK_DIR", tempfile.mkdtemp(prefix="ganit-tests-"))
os.environ.setdefault("GOOGLE_API_KEY", "test-key-not-used")

for sub in ("ingest", "serve"):
    p = str(ROOT / sub)
    if p not in sys.path:
        sys.path.insert(0, p)
