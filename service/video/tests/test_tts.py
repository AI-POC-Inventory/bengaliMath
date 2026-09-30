import io
import wave

import pytest

from tts import wav_duration_seconds


def _wav(seconds: float, framerate: int = 24000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(framerate)
        w.writeframes(b"\x00\x00" * int(framerate * seconds))
    return buf.getvalue()


def test_wav_duration_is_exact_from_frame_count():
    assert wav_duration_seconds(_wav(2.5)) == pytest.approx(2.5, abs=1e-6)


def test_wav_duration_respects_sample_rate():
    assert wav_duration_seconds(_wav(1.0, framerate=16000)) == pytest.approx(1.0, abs=1e-6)


def test_synthesize_calls_the_client_with_bengali_voice_and_linear16(monkeypatch):
    """No real network/spend: only TextToSpeechClient itself is replaced (not
    the whole module -- see the note above this test file's earlier attempt
    via sys.modules, which silently didn't take effect once `google.cloud`
    had already cached a real `texttospeech` submodule attribute from an
    earlier import elsewhere in the test run). Real request-building classes
    (SynthesisInput etc.) are used as-is, so this also pins the request shape:
    language, voice, and LINEAR16 specifically -- render.py's duration/muxing
    logic assumes uncompressed WAV frames, not an MP3's variable frame size."""
    from google.cloud import texttospeech as real_tts

    calls = {}

    class FakeResponse:
        audio_content = _wav(0.75)

    class FakeClient:
        def synthesize_speech(self, input, voice, audio_config):
            calls["input"] = input
            calls["voice"] = voice
            calls["audio_config"] = audio_config
            return FakeResponse()

    monkeypatch.setattr(real_tts, "TextToSpeechClient", lambda: FakeClient())

    import tts
    result = tts.synthesize("অনুপাত কী", voice="bn-IN-Chirp3-HD-Achernar")

    assert calls["input"].text == "অনুপাত কী"
    assert calls["voice"].language_code == "bn-IN" and calls["voice"].name == "bn-IN-Chirp3-HD-Achernar"
    assert calls["audio_config"].audio_encoding == real_tts.AudioEncoding.LINEAR16
    assert result.duration_seconds == pytest.approx(0.75, abs=1e-6)
    assert result.wav_bytes == FakeResponse.audio_content


def test_assert_voice_exists_passes_when_voice_is_listed(monkeypatch):
    import types

    from google.cloud import texttospeech as real_tts

    class FakeVoice:
        def __init__(self, name): self.name = name

    class FakeClient:
        def list_voices(self, language_code):
            assert language_code == "bn-IN"
            return types.SimpleNamespace(voices=[FakeVoice("bn-IN-Chirp3-HD-Achernar"), FakeVoice("bn-IN-Chirp3-HD-Zephyr")])

    monkeypatch.setattr(real_tts, "TextToSpeechClient", lambda: FakeClient())

    import tts
    tts.assert_voice_exists("bn-IN-Chirp3-HD-Achernar")   # no raise


def test_assert_voice_exists_raises_with_the_available_list_when_missing(monkeypatch):
    import types

    from google.cloud import texttospeech as real_tts

    class FakeVoice:
        def __init__(self, name): self.name = name

    class FakeClient:
        def list_voices(self, language_code):
            return types.SimpleNamespace(voices=[FakeVoice("bn-IN-Chirp3-HD-Zephyr")])

    monkeypatch.setattr(real_tts, "TextToSpeechClient", lambda: FakeClient())

    import tts
    with pytest.raises(tts.UnknownVoiceError, match="bn-IN-Chirp3-HD-Zephyr"):
        tts.assert_voice_exists("bn-IN-Chirp3-HD-Nonexistent")
