"""Render a worked example's pictorial representation (diagram_spec.py's 8
types) to a PIL image for compositing into a video slide. The PIL mirror of
ui/src/components/diagrams/DiagramView.tsx -- same 8 types, same proportions
where it matters, so a student sees essentially the same picture whether
they're reading the lesson or watching the video. Like that component, every
number drawn here comes straight from the already-validated spec; this module
only lays shapes out.

Reuses slides.py's font-fallback text drawing (_draw_text/_text_width) rather
than duplicating it -- the same NotoSansBengali-is-missing-math-symbols
problem applies to diagram labels (°, √, etc.) as much as slide body text.
"""
from __future__ import annotations

import math

from PIL import Image, ImageDraw

from slides import ACCENT, BG, SUB, TEXT, _draw_text, _text_width

SECOND = (245, 158, 11)        # amber -- the diagram catalog's second contrast color
ACCENT_SOFT = (219, 234, 254)
SECOND_SOFT = (254, 243, 199)

_BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯"


def bn(n) -> str:
    """Render a number with Bengali digit glyphs, matching the student lesson
    view's toBengaliNumber() convention."""
    s = str(n)
    return "".join(_BENGALI_DIGITS[int(ch)] if ch.isdigit() else ch for ch in s)


def _center_text(draw, cx, y, text, size, bold=False, fill=TEXT):
    w = _text_width(draw, text, size, bold)
    _draw_text(draw, (cx - w / 2, y), text, size, bold, fill)


# ── ratio_icons ──────────────────────────────────────────────────────────

def _ratio_icons(draw, W, H, spec):
    a, b = spec["values"]
    la, lb = spec["labels"]

    def row(count, y, color, label):
        r, gap = 11, 34
        start_x = W / 2 - (count - 1) * gap / 2
        for i in range(count):
            cx = start_x + i * gap
            draw.ellipse((cx - r, y - r, cx + r, y + r), fill=color)
        _draw_text(draw, (26, y - 10), label, 20, True, TEXT)

    row(a, H * 0.32, ACCENT, la)
    row(b, H * 0.58, SECOND, lb)
    _center_text(draw, W / 2, H - 42, f"{bn(a)} : {bn(b)}", 24, True)


# ── percent_grid ─────────────────────────────────────────────────────────

def _percent_grid(draw, W, H, spec):
    cols = rows = 10
    cell = min(W, H - 60) / cols * 0.85
    shaded = round(spec["percent"])
    gx, gy = (W - cell * cols) / 2, 20
    for i in range(rows * cols):
        row, col = divmod(i, cols)
        x, y = gx + col * cell, gy + row * cell
        color = ACCENT if i < shaded else (226, 232, 240)
        draw.rectangle((x, y, x + cell - 2, y + cell - 2), fill=color, outline=(203, 213, 225))
    _center_text(draw, W / 2, H - 42, f"{bn(spec['percent'])}%", 24, True)


# ── fraction_split ───────────────────────────────────────────────────────

def _fraction_split(draw, W, H, spec):
    n, d = spec["numerator"], spec["denominator"]
    bars = max(1, math.ceil(n / d))
    bar_w, bar_h, gap = W * 0.8, 60, 18
    piece_w = bar_w / d
    top = 20
    remaining = n
    for bi in range(bars):
        y = top + bi * (bar_h + gap)
        filled = min(d, max(0, remaining))
        remaining -= filled
        for pi in range(d):
            x = (W - bar_w) / 2 + pi * piece_w
            color = ACCENT if pi < filled else (226, 232, 240)
            draw.rectangle((x, y, x + piece_w - 3, y + bar_h), fill=color, outline=(203, 213, 225))
    _center_text(draw, W / 2, H - 42, f"{bn(n)}/{bn(d)}", 24, True)


# ── exponent_stack ───────────────────────────────────────────────────────

def _exponent_stack(draw, W, H, spec):
    base, exponent = spec["base"], spec["exponent"]
    product = base ** exponent
    box, gap_sym = 56, 34
    total = exponent * box + (exponent - 1) * gap_sym
    start_x, y = (W - total) / 2, H * 0.3
    for i in range(exponent):
        x = start_x + i * (box + gap_sym)
        draw.rounded_rectangle((x, y, x + box, y + box), radius=10, fill=ACCENT_SOFT, outline=ACCENT, width=3)
        _center_text(draw, x + box / 2, y + box / 2 - 15, bn(base), 26, True, ACCENT)
        if i < exponent - 1:
            _center_text(draw, x + box + gap_sym / 2, y + box / 2 - 15, "×", 26, False, SUB)
    _center_text(draw, W / 2, H - 42, f"{bn(base)}^{bn(exponent)} = {bn(product)}", 22, True)


# ── square_root_square ───────────────────────────────────────────────────

def _square_root_square(draw, W, H, spec):
    n = spec["n"]
    root = round(math.sqrt(n))
    max_side = min(W, H - 70) * 0.75
    cell = max_side / root
    gx, gy = (W - cell * root) / 2, 16
    for i in range(root * root):
        row, col = divmod(i, root)
        x, y = gx + col * cell, gy + row * cell
        draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=ACCENT_SOFT, outline=ACCENT)
    _draw_text(draw, (gx - 34, gy + cell * root / 2 - 12), bn(root), 20, True, TEXT)
    _center_text(draw, gx + cell * root / 2, gy + cell * root + 10, bn(root), 20, True, TEXT)
    _center_text(draw, W / 2, H - 42, f"√{bn(n)} = {bn(root)}", 24, True)


# ── area_grid ────────────────────────────────────────────────────────────

def _area_grid(draw, W, H, spec):
    rows, cols = spec["rows"], spec["cols"]
    cell = min(40, (W * 0.75) / cols, (H - 90) / rows)
    gx, gy = (W - cell * cols) / 2, 16
    for i in range(rows * cols):
        row, col = divmod(i, cols)
        x, y = gx + col * cell, gy + row * cell
        draw.rectangle((x, y, x + cell - 2, y + cell - 2), fill=ACCENT_SOFT, outline=ACCENT)
    _center_text(draw, gx + cell * cols / 2, gy + cell * rows + 8, f"{bn(cols)} একক", 16, False, SUB)
    _draw_text(draw, (gx - 40, gy + cell * rows / 2 - 10), bn(rows), 16, False, SUB)
    _center_text(draw, W / 2, H - 42, f"ক্ষেত্রফল = {bn(rows)} × {bn(cols)} = {bn(rows * cols)}", 20, True)


# ── equation_balance ─────────────────────────────────────────────────────

def _balance_pan(draw, terms, cx, y_top):
    box, gap = 46, 10
    total_w = len(terms) * box + (len(terms) - 1) * gap
    start_x, y = cx - total_w / 2, y_top
    draw.line((cx, y_top - 40, cx, y - 2), fill=SUB, width=3)
    draw.line((start_x - 14, y - 2, start_x + total_w + 14, y - 2), fill=SUB, width=3)
    for i, t in enumerate(terms):
        x = start_x + i * (box + gap)
        is_x = t == "x"
        draw.rounded_rectangle((x, y, x + box, y + box), radius=8,
                               fill=SECOND_SOFT if is_x else ACCENT_SOFT,
                               outline=SECOND if is_x else ACCENT, width=3)
        label = "x" if is_x else bn(t)
        _center_text(draw, x + box / 2, y + box / 2 - 14, label, 22, True, SECOND if is_x else ACCENT)


def _equation_balance(draw, W, H, spec):
    left, right = spec["left"], spec["right"]
    beam_y = H * 0.28
    draw.polygon([(W / 2 - 16, beam_y), (W / 2 + 16, beam_y), (W / 2, beam_y - 26)], fill=SUB)
    draw.line((W * 0.18, beam_y, W * 0.82, beam_y), fill=TEXT, width=4)
    _balance_pan(draw, left, W * 0.3, beam_y + 40)
    _balance_pan(draw, right, W * 0.7, beam_y + 40)

    def side_text(terms):
        return " + ".join("x" if t == "x" else bn(t) for t in terms)
    _center_text(draw, W / 2, H - 42, f"{side_text(left)}  =  {side_text(right)}", 20, True)


# ── symmetry_mirror ──────────────────────────────────────────────────────

def _symmetry_shape(draw, shape, cx, cy, size):
    if shape == "circle":
        draw.ellipse((cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2), fill=ACCENT_SOFT, outline=ACCENT, width=3)
    elif shape == "rectangle":
        draw.rectangle((cx - size / 2, cy - size / 3, cx + size / 2, cy + size / 3), fill=ACCENT_SOFT, outline=ACCENT, width=3)
    else:  # triangle: an asymmetric right-angle shape, so a true mirror is visible
        x, y = cx - size / 2, cy + size / 2
        draw.polygon([(x, y), (x, y - size), (x + size, y)], fill=ACCENT_SOFT, outline=ACCENT, width=3)


def _symmetry_mirror(draw, W, H, spec):
    shape, axis, size = spec["shape"], spec["axis"], min(W, H) * 0.3
    if axis == "vertical":
        axis_x = W / 2
        _dashed_line(draw, (axis_x, 16), (axis_x, H - 30))
        _symmetry_shape(draw, shape, axis_x - size * 0.75, H / 2 - 10, size)
        _symmetry_shape_mirrored_x(draw, shape, axis_x, axis_x - size * 0.75, H / 2 - 10, size)
    else:
        axis_y = H / 2 - 10
        _dashed_line(draw, (30, axis_y), (W - 30, axis_y))
        _symmetry_shape(draw, shape, W / 2, axis_y - size * 0.6, size)
        _symmetry_shape_mirrored_y(draw, shape, axis_y, W / 2, axis_y - size * 0.6, size)
    _center_text(draw, W / 2, H - 42, f"প্রতিসাম্য রেখা ({'উলম্ব' if axis == 'vertical' else 'আনুভূমিক'})", 18, True)


def _dashed_line(draw, p0, p1, dash=10, gap=7):
    (x0, y0), (x1, y1) = p0, p1
    length = math.hypot(x1 - x0, y1 - y0)
    if length == 0:
        return
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    d = 0.0
    while d < length:
        seg_end = min(d + dash, length)
        draw.line((x0 + ux * d, y0 + uy * d, x0 + ux * seg_end, y0 + uy * seg_end), fill=SUB, width=2)
        d += dash + gap


def _symmetry_shape_mirrored_x(draw, shape, axis_x, cx, cy, size):
    mirrored_cx = 2 * axis_x - cx
    if shape == "triangle":
        x, y = cx - size / 2, cy + size / 2
        mx = 2 * axis_x - x
        draw.polygon([(mx, y), (mx, y - size), (mx - size, y)], fill=ACCENT_SOFT, outline=ACCENT, width=3)
    else:
        _symmetry_shape(draw, shape, mirrored_cx, cy, size)


def _symmetry_shape_mirrored_y(draw, shape, axis_y, cx, cy, size):
    mirrored_cy = 2 * axis_y - cy
    if shape == "triangle":
        x, y = cx - size / 2, cy + size / 2
        my = 2 * axis_y - y
        draw.polygon([(x, my), (x, my + size), (x + size, my)], fill=ACCENT_SOFT, outline=ACCENT, width=3)
    else:
        _symmetry_shape(draw, shape, cx, mirrored_cy, size)


_RENDERERS = {
    "ratio_icons": _ratio_icons,
    "percent_grid": _percent_grid,
    "fraction_split": _fraction_split,
    "exponent_stack": _exponent_stack,
    "square_root_square": _square_root_square,
    "area_grid": _area_grid,
    "equation_balance": _equation_balance,
    "symmetry_mirror": _symmetry_mirror,
}


def render_diagram(spec: dict, width: int, height: int) -> Image.Image:
    img = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(img)
    renderer = _RENDERERS.get(spec.get("type"))
    if renderer:
        renderer(draw, width, height, spec)
    return img
