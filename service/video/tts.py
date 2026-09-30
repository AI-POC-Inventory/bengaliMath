"""Bengali narration via Google Cloud Text-to-Speech (Chirp 3 HD, bn-IN).

Requests LINEAR16 (uncompressed WAV) specifically so a slide's audio duration
is exact and cheap to compute -- byte length / (sample rate * bytes per
sample) -- with no dependency on ffprobe or a codec-aware library just to
answer "how long is this clip", which is also what render.py needs to decide
how long to hold each slide on screen.
"""
from __future__ import annotations

import os
import wave
from dataclasses import dataclass
from io import BytesIO

TTS_VOICE = os.environ.get("TTS_VOICE", "bn-IN-Chirp3-HD-Achernar")
TTS_LANGUAGE_CODE = "bn-IN"
SAMPLE_RATE_HZ = 24000


class UnknownVoiceError(RuntimeError):
    pass


def assert_voice_exists(voice: str = TTS_VOICE, language_code: str = TTS_LANGUAGE_CODE) -> None:
    """Cloud TTS's Chirp 3 HD voice roster is a set of shared star-names per
    language, released incrementally per locale -- TTS_VOICE's exact spelling
    is not hard-verified at authoring time. Calling this once at the start of
    entrypoint.py turns a possible typo/unavailable-voice into one clear
    startup error instead of a failure discovered mid-render, or worse, a
    silent fall-back to some other voice."""
    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    names = {v.name for v in client.list_voices(language_code=language_code).voices}
    if voice not in names:
        raise UnknownVoiceError(
            f"{voice!r} is not an available voice for {language_code}. "
            f"Available: {sorted(names)}")


@dataclass
class Narration:
    wav_bytes: bytes
    duration_seconds: float


def wav_duration_seconds(wav_bytes: bytes) -> float:
    with wave.open(BytesIO(wav_bytes), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def synthesize(text: str, voice: str = TTS_VOICE) -> Narration:
    """One Cloud TTS call. Text must already be under the API's per-request
    limit -- script_builder.MAX_NARRATION_CHARS keeps every slide's narration
    well inside it."""
    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    response = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=text),
        voice=texttospeech.VoiceSelectionParams(language_code=TTS_LANGUAGE_CODE, name=voice),
        audio_config=texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.LINEAR16,
            sample_rate_hertz=SAMPLE_RATE_HZ,
        ),
    )
    return Narration(response.audio_content, wav_duration_seconds(response.audio_content))
