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
    from slides import _wrap
    dummy = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    long_lines = _wrap(dummy, long_text, 30, False, WIDTH - 180)
    short_lines = _wrap(dummy, short_text, 30, False, WIDTH - 180)
    assert len(long_lines) > 1
    assert len(short_lines) == 1
    assert short_lines[0] == short_text
    assert "".join(long_lines).replace(" ", "") == long_text.strip().replace(" ", "")


def test_math_symbols_missing_from_the_bengali_font_fall_back_and_still_measure_width():
    """The bug found in the first real deployed run: '2³' rendered as a tofu
    box because NotoSansBengali's cmap doesn't cover superscript digits (or
    °/≈/√/π/∞) -- confirmed directly against the real font file, not assumed.
    _wrap/_draw_text must resolve those characters to the fallback font
    instead of silently drawing .notdef, and _text_width (used for wrapping)
    must agree with what actually gets drawn."""
    from slides import _resolve_font_path, _runs, _text_width, _primary_path, _find_font, _FALLBACK_CANDIDATES
    from PIL import ImageDraw
    primary = _primary_path(bold=False)
    fallback = _find_font(_FALLBACK_CANDIDATES)
    if not fallback:
        pytest.skip("no fallback font available on this machine")

    for ch in "²³⁴⁰¹×°≈√π∞":
        assert _resolve_font_path(ch, bold=False) in (primary, fallback), ch

    dummy = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    mixed = "2³ কে 2 × 2 × 2 = 8 ভাবা উচিত, প্রায় (≈) নয়।"
    runs = _runs(mixed, 30, False)
    assert "".join(seg for seg, _ in runs) == mixed        # every character accounted for, none dropped
    assert len(runs) > 1, "a run boundary must exist where the font actually changes"
    # width used for wrapping must equal the sum of what actually gets drawn
    assert _text_width(dummy, mixed, 30, False) == pytest.approx(
        sum(dummy.textlength(seg, font=f) for seg, f in runs))


def test_bengali_word_stays_one_draw_call_so_shaping_is_not_broken():
    """Conjuncts/matras only shape correctly within a single draw.text() call.
    A run boundary must never appear in the middle of a plain Bengali word --
    only where an actually-unsupported character sits next to it."""
    from slides import _runs
    word = "গ্রন্থাগার"                     # a real word with a conjunct
    runs = _runs(word, 30, False)
    assert len(runs) == 1 and runs[0][0] == word


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
    with pytest.raises(slides.NoBengaliFontError):
        render_slide({"kind": "title", "heading": "H", "body": [], "narration": ""})
