"""Test setup for service/db: make the modules importable without credentials.

supabase_client connects to Supabase at import time and embed talks to Gemini,
so both are replaced with inert stubs before any test imports the generators.
Tests that need database behaviour install their own fake on
`module.supabase` (see test_lesson_generator.py).

Run:  cd service/db && python -m pytest tests
"""
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_supabase_client = types.ModuleType("supabase_client")
_supabase_client.supabase = None
sys.modules["supabase_client"] = _supabase_client

_embed = types.ModuleType("embed")
_embed.embed_documents = lambda texts: []
_embed.max_cosine_similarity = lambda cand, against: (0.0, -1)
sys.modules["embed"] = _embed
