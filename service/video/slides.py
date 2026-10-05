"""Render one script slide (script_builder.build_script's dict shape) to a PNG
frame. Deliberately plain: a heading, wrapped body lines/bullets, on the same
visual language as the student-facing LessonView (light background, blue
accent, no decoration that could distract from a math explanation).

Font fallback: NotoSansBengali (the Bengali-script font) does NOT cover
superscript digits, degree/almost-equal/root/pi/infinity -- confirmed by
inspecting its cmap directly, not assumed -- even though it does cover plain
digits, danda (।) and the multiplication/division signs. Math content in this
app (see service/db/lesson_generator.py's _MATH_TEXT_RULE, e.g. "10²") will
routinely contain exactly the characters it's missing, so every character is
drawn with whichever installed font actually covers it (DejaVuSans as the
fallback, which covers those symbols but not Bengali digits or danda -- the
two fonts are complementary, not interchangeable).

This is per-CHARACTER-RUN, not per-character: PIL's text shaping (via raqm,
needed for correct Bengali conjuncts/matras) only works within one draw.text()
call, so splitting a Bengali word into single-character draws would silently
break its shaping. Runs are only split at the (rare) boundary where the
resolved font actually changes -- a Bengali word stays one draw call.
"""
from __future__ import annotations

import os
from functools import lru_cache

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1280, 720
BG = (248, 250, 252)          # matches ui's light-mode background (#f8fafc)
TEXT = (30, 41, 59)           # #1e293b
ACCENT = (37, 99, 235)        # #2563eb
SUB = (100, 116, 139)         # #64748b
MARGIN = 90

# Debian/Ubuntu apt package fonts-noto-core installs these (confirmed via
# `dpkg -L`, not guessed); Windows dev machines have Nirmala UI instead.
# First match wins, so the container (production) and a developer's machine
# (tests) both render real glyphs rather than tofu boxes.
_FONT_CANDIDATES = [
    os.environ.get("BENGALI_FONT_PATH", ""),
    "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
    "C:/Windows/Fonts/Nirmala.ttc",
]
_BOLD_CANDIDATES = [
    os.environ.get("BENGALI_FONT_BOLD_PATH", ""),
    "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf",
    "C:/Windows/Fonts/Nirmala.ttc",
]
# fonts-dejavu-core (Dockerfile) on the container; Arial/Segoe UI cover the
# same symbol set closely enough for local dev/tests on Windows.
_FALLBACK_CANDIDATES = [
    os.environ.get("FALLBACK_FONT_PATH", ""),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
]


def _find_font(candidates: list[str]) -> str | None:
    return next((p for p in candidates if p and os.path.exists(p)), None)


class NoBengaliFontError(RuntimeError):
    """Raised when no font capable of rendering Bengali script is available.
    Slides with tofu boxes instead of text would be worse than failing loudly
    -- this must surface as a 'failed' generation, not a silently broken
    video."""


@lru_cache(maxsize=None)
def _load(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size, index=0)


@lru_cache(maxsize=None)
def _cmap(path: str) -> frozenset[int]:
    """The set of codepoints a font file can actually render, read from its
    own cmap table -- the only reliable way to know this (PIL happily draws a
    missing glyph as its .notdef box without raising)."""
    return frozenset((TTFont(path, fontNumber=0, lazy=True).getBestCmap() or {}).keys())


def _primary_path(bold: bool) -> str:
    path = _find_font(_BOLD_CANDIDATES if bold else _FONT_CANDIDATES)
    if not path:
        raise NoBengaliFontError(
            "No Bengali-capable font found. In the container this means "
            "fonts-noto-core wasn't installed; see service/video/Dockerfile.")
    return path


def _resolve_font_path(ch: str, bold: bool) -> str:
    primary = _primary_path(bold)
    if ch.isspace() or ord(ch) in _cmap(primary):
        return primary
    fallback = _find_font(_FALLBACK_CANDIDATES)
    if fallback and ord(ch) in _cmap(fallback):
        return fallback
    return primary          # last resort: may render as tofu, never crashes


def _runs(text: str, size: int, bold: bool) -> list[tuple[str, ImageFont.FreeTypeFont]]:
    """Maximal substrings sharing one resolved font, each as one (text, font)
    pair -- so a Bengali word is always drawn in a single call and keeps its
    shaping, and only an isolated unsupported character (a superscript digit,
    °, etc.) becomes its own run in the fallback font."""
    if not text:
        return []
    out: list[tuple[str, ImageFont.FreeTypeFont]] = []
    start, current_path = 0, _resolve_font_path(text[0], bold)
    for i in range(1, len(text)):
        path = _resolve_font_path(text[i], bold)
        if path != current_path:
            out.append((text[start:i], _load(current_path, size)))
            start, current_path = i, path
    out.append((text[start:], _load(current_path, size)))
    return out


def _text_width(draw: ImageDraw.ImageDraw, text: str, size: int, bold: bool) -> float:
    return sum(draw.textlength(seg, font=f) for seg, f in _runs(text, size, bold))


def _draw_text(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str,
               size: int, bold: bool, fill: tuple[int, int, int]) -> None:
    x, y = xy
    for seg, f in _runs(text, size, bold):
        draw.text((x, y), seg, font=f, fill=fill)
        x += draw.textlength(seg, font=f)


def _wrap(draw: ImageDraw.ImageDraw, text: str, size: int, bold: bool, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines, current = [], words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if _text_width(draw, candidate, size, bold) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


# An example slide carrying a diagram gets a two-column layout: diagram on
# the right (its own module, see diagrams.py), problem/steps/answer text in a
# narrower left column -- rather than a diagram squeezed under full-width
# text, which is cramped and buries the picture below the fold.
DIAGRAM_BOX = (680, 150, WIDTH - MARGIN, HEIGHT - 50)   # (x0, y0, x1, y1)


def render_slide(slide: dict) -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    heading_size = 54 if slide["kind"] in ("title", "section_title") else 38
    _draw_text(draw, (MARGIN, 70 if slide["kind"] in ("title", "section_title") else 50),
              slide["heading"], heading_size, True, ACCENT)

    if slide["kind"] == "title":
        draw.line((MARGIN, 150, WIDTH - MARGIN, 150), fill=ACCENT, width=3)
        return img
    if slide["kind"] == "section_title":
        return img

    diagram_spec = slide.get("diagram")
    if diagram_spec:
        import diagrams                 # lazy: diagrams.py imports from this module at its own top level
        x0, y0, x1, y1 = DIAGRAM_BOX
        img.paste(diagrams.render_diagram(diagram_spec, x1 - x0, y1 - y0), (x0, y0))
        content_width = x0 - MARGIN - 20
    else:
        content_width = WIDTH - 2 * MARGIN

    body_size = 30 if not diagram_spec else 25
    y = 150
    line_height = 46 if not diagram_spec else 38
    bulleted = slide["kind"] in ("key_points", "common_mistakes")

    indent = 30 if bulleted else 0
    for item in slide["body"]:
        wrapped = _wrap(draw, item, body_size, False, content_width - indent)
        for i, line in enumerate(wrapped):
            if bulleted and i == 0:
                draw.ellipse((MARGIN, y + 12, MARGIN + 10, y + 22), fill=ACCENT)
            _draw_text(draw, (MARGIN + indent, y), line, body_size, False, TEXT)
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
