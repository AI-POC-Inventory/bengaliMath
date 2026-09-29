import pytest
from PIL import Image

from slides import HEIGHT, WIDTH, render_slide, render_slide_png


def test_png_smoke():
    png = render_slide_png({"kind": "title", "heading": "অনুপাত", "body": [], "narration": ""})
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    img = Image.open(__import__("io").BytesIO(png))
    assert img.size == (WIDTH, HEIGHT)


@pytest.mark.parametrize("kind", ["title", "section_title", "explanation", "key_points", "example", "common_mistakes", "takeaway"])
def test_every_slide_kind_renders_without_error(kind):
    slide = {"kind": kind, "heading": "শিরোনাম", "body": ["একটি লাইন।", "আরেকটি লাইন।"], "narration": ""}
    img = render_slide(slide)
    assert img.size == (WIDTH, HEIGHT)


def test_empty_body_does_not_crash():
    render_slide({"kind": "explanation", "heading": "শিরোনাম", "body": [], "narration": ""})


def test_long_line_wraps_to_multiple_lines():
    """A regression guard for the exact bug fixed before commit: a garbled
    ternary once made every body line reuse the SAME wrap result regardless
    of item, so a long line either duplicated text or dropped it."""
    long_text = "এইটি একটি অত্যন্ত দীর্ঘ বাক্য যা একটি স্লাইডের প্রস্থের চেয়ে অনেক বড় এবং তাই একাধিক লাইনে ভাগ হয়ে যাওয়া উচিত। " * 2
    short_text = "ছোট লাইন।"
    from PIL import ImageDraw
    from slides import _font, _wrap
    dummy = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    long_lines = _wrap(dummy, long_text, _font(30), WIDTH - 180)
    short_lines = _wrap(dummy, short_text, _font(30), WIDTH - 180)
    assert len(long_lines) > 1
    assert len(short_lines) == 1
    assert short_lines[0] == short_text
    assert "".join(long_lines).replace(" ", "") == long_text.strip().replace(" ", "")


def test_bulleted_kinds_indent_differently_from_prose_kinds():
    """Not a golden-pixel test (font rendering varies by host), just checks the
    two code paths actually diverge: a bullet must be drawn for list kinds."""
    from unittest.mock import patch
    with patch("slides.ImageDraw.Draw") as mock_draw_cls:
        draw = mock_draw_cls.return_value
        draw.textlength.side_effect = lambda text, font: len(text) * 15   # deterministic fake metric
        render_slide({"kind": "key_points", "heading": "H", "body": ["পয়েন্ট"], "narration": ""})
        assert draw.ellipse.called, "bulleted kind must draw a bullet marker"

    with patch("slides.ImageDraw.Draw") as mock_draw_cls:
        draw = mock_draw_cls.return_value
        draw.textlength.side_effect = lambda text, font: len(text) * 15
        render_slide({"kind": "explanation", "heading": "H", "body": ["গদ্য"], "narration": ""})
        assert not draw.ellipse.called, "prose kind must not draw a bullet marker"


def test_missing_font_raises_a_clear_error(monkeypatch):
    import slides
    monkeypatch.setattr(slides, "_FONT_CANDIDATES", ["/no/such/font.ttf"])
    monkeypatch.setattr(slides, "_BOLD_CANDIDATES", ["/no/such/font.ttf"])
    slides._font.cache_clear()
    with pytest.raises(slides.NoBengaliFontError):
        render_slide({"kind": "title", "heading": "H", "body": [], "narration": ""})
    slides._font.cache_clear()          # don't leak the cleared cache into other tests
