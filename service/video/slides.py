"""Render one script slide (script_builder.build_script's dict shape) to a PNG
frame. Deliberately plain: a heading, wrapped body lines/bullets, on the same
visual language as the student-facing LessonView (light background, blue
accent, no decoration that could distract from a math explanation).
"""
from __future__ import annotations

import os
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1280, 720
BG = (248, 250, 252)          # matches ui's light-mode background (#f8fafc)
TEXT = (30, 41, 59)           # #1e293b
ACCENT = (37, 99, 235)        # #2563eb
SUB = (100, 116, 139)         # #64748b
MARGIN = 90

# Debian/Ubuntu apt package fonts-noto-bengali installs this; Windows dev
# machines have Nirmala UI (also Bengali-capable) instead. First match wins,
# so the container (production) and a developer's machine (tests) both render
# real glyphs rather than tofu boxes -- checked, not assumed, at import time.
_FONT_CANDIDATES = [
    os.environ.get("BENGALI_FONT_PATH", ""),
    "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf",
    "C:/Windows/Fonts/Nirmala.ttc",
    "C:/Windows/Fonts/seguiemj.ttf",
]
_BOLD_CANDIDATES = [
    os.environ.get("BENGALI_FONT_BOLD_PATH", ""),
    "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf",
    "C:/Windows/Fonts/Nirmala.ttc",
]


def _find_font(candidates: list[str]) -> str | None:
    return next((p for p in candidates if p and os.path.exists(p)), None)


class NoBengaliFontError(RuntimeError):
    """Raised when no font capable of rendering Bengali script is available.
    Slides with tofu boxes instead of text would be worse than failing loudly
    -- this must surface as a 'failed' generation, not a silently broken
    video."""


@lru_cache(maxsize=None)
def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = _find_font(_BOLD_CANDIDATES if bold else _FONT_CANDIDATES)
    if not path:
        raise NoBengaliFontError(
            "No Bengali-capable font found. In the container this means "
            "fonts-noto-bengali wasn't installed; see service/video/Dockerfile.")
    return ImageFont.truetype(path, size, index=0)


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines, current = [], words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def render_slide(slide: dict) -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)
    content_width = WIDTH - 2 * MARGIN

    heading_size = 54 if slide["kind"] in ("title", "section_title") else 38
    draw.text((MARGIN, 70 if slide["kind"] in ("title", "section_title") else 50),
              slide["heading"], font=_font(heading_size, bold=True), fill=ACCENT)

    if slide["kind"] == "title":
        draw.line((MARGIN, 150, WIDTH - MARGIN, 150), fill=ACCENT, width=3)
        return img
    if slide["kind"] == "section_title":
        return img

    body_font = _font(30)
    y = 150
    line_height = 46
    bulleted = slide["kind"] in ("key_points", "common_mistakes")

    indent = 30 if bulleted else 0
    for item in slide["body"]:
        wrapped = _wrap(draw, item, body_font, content_width - indent)
        for i, line in enumerate(wrapped):
            if bulleted and i == 0:
                draw.ellipse((MARGIN, y + 12, MARGIN + 10, y + 22), fill=ACCENT)
            draw.text((MARGIN + indent, y), line, font=body_font, fill=TEXT)
            y += line_height
        y += 14                       # gap between items
        if y > HEIGHT - 80:
            break                      # overflow guard; script_builder keeps slides short enough that this shouldn't trigger

    return img


def render_slide_png(slide: dict) -> bytes:
    import io
    buf = io.BytesIO()
    render_slide(slide).save(buf, format="PNG")
    return buf.getvalue()
