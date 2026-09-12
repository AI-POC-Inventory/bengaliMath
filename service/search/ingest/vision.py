"""Vision provider seam.

Two providers, selected by EXTRACT_PROVIDER. Both return (text, usage) so the
rest of the pipeline never knows which one ran.

  anthropic -- claude-opus-5 by default. Highest quality on this book, but the
               project's current key returns 400 "credit balance is too low";
               top up and set EXTRACT_PROVIDER=anthropic to use it.
  gemini    -- gemini-2.5-flash. Works with the project's existing key today
               and is what the deployed Job runs.
"""
import base64
import logging
import os

from config import (ANTHROPIC_API_KEY, GOOGLE_API_KEY, EXTRACT_MODEL,
                    EXTRACT_MAX_TOKENS, EXTRACT_PROVIDER, GEMINI_EXTRACT_MODEL)

log = logging.getLogger("vision")

_anthropic = None
_genai = None


def _anthropic_client():
    global _anthropic
    if _anthropic is None:
        import anthropic
        _anthropic = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _anthropic


def _gemini_client():
    global _genai
    if _genai is None:
        from google import genai
        _genai = genai.Client(api_key=GOOGLE_API_KEY)
    return _genai


def _call_anthropic(image_bytes, system, user, model):
    resp = _anthropic_client().messages.create(
        model=model or EXTRACT_MODEL,
        max_tokens=EXTRACT_MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64",
                                         "media_type": "image/png",
                                         "data": base64.standard_b64encode(image_bytes).decode()}},
            {"type": "text", "text": user},
        ]}],
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError(f"refused: {getattr(resp, 'stop_details', None)}")
    text = "".join(b.text for b in resp.content if b.type == "text")
    return text, {"input_tokens": resp.usage.input_tokens,
                  "output_tokens": resp.usage.output_tokens,
                  "model": resp.model, "provider": "anthropic"}


def _call_gemini(image_bytes, system, user, model):
    from google.genai import types
    m = model or GEMINI_EXTRACT_MODEL
    resp = _gemini_client().models.generate_content(
        model=m,
        contents=[types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                  types.Part.from_text(text=user)],
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=EXTRACT_MAX_TOKENS,
            temperature=0.0,
            response_mime_type="application/json",
        ),
    )
    um = resp.usage_metadata
    return resp.text or "", {
        "input_tokens": getattr(um, "prompt_token_count", 0),
        "output_tokens": getattr(um, "candidates_token_count", 0),
        "model": m, "provider": "gemini",
    }


def call_vision(image_bytes: bytes, system: str, user: str, model: str | None = None):
    """Transcribe one page image. Returns (text, usage)."""
    if EXTRACT_PROVIDER == "anthropic":
        return _call_anthropic(image_bytes, system, user, model)
    return _call_gemini(image_bytes, system, user, model)


def count_input_tokens(image_bytes: bytes, system: str, user: str,
                       model: str | None = None) -> int:
    """Exact input-token count without running the model. Used by the cost model
    so projections are measured rather than guessed."""
    if EXTRACT_PROVIDER == "anthropic":
        r = _anthropic_client().messages.count_tokens(
            model=model or EXTRACT_MODEL, system=system,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64",
                                             "media_type": "image/png",
                                             "data": base64.standard_b64encode(image_bytes).decode()}},
                {"type": "text", "text": user},
            ]}],
        )
        return r.input_tokens
    from google.genai import types
    r = _gemini_client().models.count_tokens(
        model=model or GEMINI_EXTRACT_MODEL,
        contents=[types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                  types.Part.from_text(text=user)],
    )
    return r.total_tokens
