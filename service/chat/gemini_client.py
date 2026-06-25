import os
from google import genai

# Model used for chat completions and audio transcription.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def get_gemini_api_key() -> str:
    """Read the Gemini API key from the environment (injected by Cloud Run)."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY environment variable is required")
    return key


def get_client() -> genai.Client:
    """Create a Gemini client using the env-provided API key."""
    return genai.Client(api_key=get_gemini_api_key())
