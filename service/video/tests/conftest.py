"""Make service/video importable without GCP credentials, and prefer a bundled
ffmpeg binary for tests so they don't depend on the host having one installed
(the Dockerfile installs ffmpeg via apt for the real container; imageio_ffmpeg
gives an equivalent binary for local/CI test runs -- see render.ffmpeg_binary).
"""
import os
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# supabase_client connects at import time (eager `create_client(...)`), same
# as service/db's -- stub it so importing entrypoint.py needs no credentials.
# Tests that care about Supabase behaviour install their own fake on
# `entrypoint.supabase` (see test_entrypoint.py).
_supabase_client = types.ModuleType("supabase_client")
_supabase_client.supabase = None
sys.modules["supabase_client"] = _supabase_client

if "FFMPEG_BIN" not in os.environ:
    try:
        import imageio_ffmpeg
        os.environ["FFMPEG_BIN"] = imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass  # render_video tests skip themselves if no ffmpeg is resolvable
