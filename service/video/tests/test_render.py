import io
import os
import shutil
import subprocess
import wave

import pytest

from render import Clip, build_concat_script, build_ffmpeg_cmd, ffmpeg_binary, render_video


def test_build_concat_script_repeats_last_file_per_ffmpeg_requirement():
    script = build_concat_script(["a.png", "b.png"], [1.5, 2.0])
    assert script == "file 'a.png'\nduration 1.500\nfile 'b.png'\nduration 2.000\nfile 'b.png'\n"


def test_build_concat_script_empty():
    assert build_concat_script([], []) == "\n"


def test_build_concat_script_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        build_concat_script(["a.png"], [1.0, 2.0])


def test_build_ffmpeg_cmd_shape():
    cmd = build_ffmpeg_cmd("ffmpeg", "list.txt", "audio.wav", "out.mp4")
    assert cmd[0] == "ffmpeg"
    assert "-i" in cmd and "list.txt" in cmd and "audio.wav" in cmd and cmd[-1] == "out.mp4"
    assert "libx264" in cmd and "aac" in cmd
    assert "-shortest" in cmd            # video length must follow the concat'd slides, not run past the audio


def test_ffmpeg_binary_prefers_env_override(monkeypatch):
    monkeypatch.setenv("FFMPEG_BIN", "/custom/ffmpeg")
    assert ffmpeg_binary() == "/custom/ffmpeg"


def _silent_wav(seconds: float) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(b"\x00\x00" * int(24000 * seconds))
    return buf.getvalue()


def _tiny_png() -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), (255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


requires_ffmpeg = pytest.mark.skipif(
    not (os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg")),
    reason="no ffmpeg binary available (pip install imageio-ffmpeg for local runs)")


@requires_ffmpeg
def test_render_video_produces_a_real_h264_aac_mp4(tmp_path):
    clips = [
        Clip(png_bytes=_tiny_png(), wav_bytes=_silent_wav(1.0), duration_seconds=1.0),
        Clip(png_bytes=_tiny_png(), wav_bytes=_silent_wav(0.5), duration_seconds=0.5),
    ]
    out_path = str(tmp_path / "out.mp4")
    total = render_video(clips, out_path, work_dir=str(tmp_path / "work"))

    assert os.path.exists(out_path) and os.path.getsize(out_path) > 0
    assert total == pytest.approx(1.0 + 0.5 + 2 * 0.4, abs=0.01)   # + SILENCE_PADDING_SECONDS per clip

    probe = subprocess.run([ffmpeg_binary(), "-i", out_path], capture_output=True, text=True)
    assert "Video: h264" in probe.stderr
    assert "Audio: aac" in probe.stderr


@requires_ffmpeg
def test_render_video_rejects_empty_clip_list(tmp_path):
    with pytest.raises(ValueError):
        render_video([], str(tmp_path / "out.mp4"), str(tmp_path / "work"))


@requires_ffmpeg
def test_render_video_raises_with_ffmpeg_stderr_on_failure(tmp_path, monkeypatch):
    monkeypatch.setenv("FFMPEG_BIN", "/definitely/not/a/real/binary")
    clips = [Clip(png_bytes=_tiny_png(), wav_bytes=_silent_wav(0.5), duration_seconds=0.5)]
    with pytest.raises((RuntimeError, FileNotFoundError)):
        render_video(clips, str(tmp_path / "out.mp4"), str(tmp_path / "work"))
