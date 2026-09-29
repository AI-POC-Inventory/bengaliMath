"""Mux rendered slide PNGs + narration WAVs into one MP4 via ffmpeg.

Command construction is split from execution (build_concat_script /
build_ffmpeg_cmd vs. render_video) so the exact ffmpeg invocation can be unit
tested without ffmpeg installed, while render_video itself is exercised
against a real ffmpeg binary in tests (imageio_ffmpeg provides one, so this
doesn't depend on the host having ffmpeg -- see requirements.txt).
"""
from __future__ import annotations

import os
import shutil
import subprocess
import wave
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

TARGET_HEIGHT = 720           # matches slides.HEIGHT
VIDEO_BITRATE = "1000k"       # ~1Mbps: slides are low-motion, this stays legible; also the deliberate egress-cost lever
AUDIO_BITRATE = "96k"
SILENCE_PADDING_SECONDS = 0.4  # brief pause after each slide's narration


@dataclass
class Clip:
    png_bytes: bytes
    wav_bytes: bytes
    duration_seconds: float       # narration duration; on-screen hold = this + padding


def ffmpeg_binary() -> str:
    """The container installs ffmpeg via apt (see Dockerfile) and it's on
    PATH there. FFMPEG_BIN lets local dev/tests point at imageio_ffmpeg's
    bundled binary instead, without needing ffmpeg installed on the host."""
    return os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or "ffmpeg"


def build_concat_script(image_paths: list[str], durations: list[float]) -> str:
    """ffmpeg 'concat demuxer' input file: each image held for its slide's
    duration. The final entry is repeated per ffmpeg's own documented
    requirement -- the demuxer ignores the last `duration` line otherwise."""
    if len(image_paths) != len(durations):
        raise ValueError("image_paths and durations must be the same length")
    lines = []
    for path, dur in zip(image_paths, durations):
        lines.append(f"file '{path}'")
        lines.append(f"duration {dur:.3f}")
    if image_paths:
        lines.append(f"file '{image_paths[-1]}'")
    return "\n".join(lines) + "\n"


def build_ffmpeg_cmd(ffmpeg: str, concat_list_path: str, audio_path: str, out_path: str) -> list[str]:
    return [
        ffmpeg, "-y",
        "-f", "concat", "-safe", "0", "-i", concat_list_path,
        "-i", audio_path,
        "-vf", f"scale=-2:{TARGET_HEIGHT}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-b:v", VIDEO_BITRATE,
        "-c:a", "aac", "-b:a", AUDIO_BITRATE,
        "-shortest",
        out_path,
    ]


def _concat_wavs(wav_bytes_list: list[bytes], gap_seconds: float) -> bytes:
    """Concatenate WAV clips with a short silence gap between them. Plain
    stdlib `wave`, no ffmpeg needed for this part -- every clip already shares
    tts.SAMPLE_RATE_HZ/mono/16-bit, so this is just frame concatenation."""
    with wave.open(BytesIO(wav_bytes_list[0]), "rb") as first:
        params = first.getparams()
    gap_frames = int(gap_seconds * params.framerate)
    silence = b"\x00\x00" * gap_frames * params.nchannels

    out = BytesIO()
    with wave.open(out, "wb") as writer:
        writer.setparams(params)
        for i, wav_bytes in enumerate(wav_bytes_list):
            with wave.open(BytesIO(wav_bytes), "rb") as reader:
                writer.writeframes(reader.readframes(reader.getnframes()))
            if i < len(wav_bytes_list) - 1:
                writer.writeframesraw(silence)
    return out.getvalue()


def render_video(clips: list[Clip], out_path: str, work_dir: str) -> float:
    """Writes the muxed MP4 to out_path. Returns the video's total duration in
    seconds. work_dir holds intermediate files and is left for the caller to
    clean up (entrypoint.py uses a whole-run temp directory)."""
    if not clips:
        raise ValueError("no clips to render")
    Path(work_dir).mkdir(parents=True, exist_ok=True)

    image_paths = []
    for i, clip in enumerate(clips):
        path = os.path.join(work_dir, f"slide_{i:03d}.png")
        Path(path).write_bytes(clip.png_bytes)
        image_paths.append(path)

    durations = [c.duration_seconds + SILENCE_PADDING_SECONDS for c in clips]
    concat_list_path = os.path.join(work_dir, "slides.txt")
    Path(concat_list_path).write_text(build_concat_script(image_paths, durations), encoding="utf-8")

    audio_path = os.path.join(work_dir, "narration.wav")
    Path(audio_path).write_bytes(_concat_wavs([c.wav_bytes for c in clips], SILENCE_PADDING_SECONDS))

    cmd = build_ffmpeg_cmd(ffmpeg_binary(), concat_list_path, audio_path, out_path)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed (exit {result.returncode}):\n{result.stderr[-4000:]}")

    return sum(durations)
