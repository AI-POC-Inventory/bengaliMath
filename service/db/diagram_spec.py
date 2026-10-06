"""The diagram catalog: 8 visual metaphors a worked example can be paired
with, and the one validator both the lesson generator and an admin edit go
through.

Design principle (same one the whole generation pipeline already follows):
a diagram is never AI-drawn. An LLM may only CLASSIFY which of these 8 types
fits an already-verified example and ECHO the numbers already in its
problem/answer -- it never invents a new fact. Every number that ends up in a
picture is then drawn by deterministic code (SVG in the UI, PIL in the video
job), so a diagram can be wrong in *choice* (picked a type that doesn't suit
the example) but never wrong in *arithmetic* the way a generative image model
would be.

Each type's "fields" describes its parameters for the classification prompt
(lesson_generator.py) in plain Bengali-adjacent terms the model already
understands from the rest of its prompt. Each type's validator enforces tight
numeric bounds -- not because an LLM extracting "7" from "7টি আম" is likely to
be wrong, but because a bound (e.g. exponent 2-6) is also an implicit
renderability contract: an SVG/PIL renderer sized for a 720px slide cannot
usefully draw exponent_stack with exponent=40, so the bound protects the
renderer as much as the content.
"""
from __future__ import annotations

MAX_RATIO_VALUE = 12
MAX_GRID_SIZE = 10
MAX_EQUATION_TERMS = 5

# type -> (prompt field description, validator)
# The validator takes the raw dict (already confirmed to have the right
# "type") and returns a normalized dict, or None if it fails validation.


def _num(v, lo: float, hi: float, integer: bool = True) -> float | int | None:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if integer:
        if n != int(n):
            return None
        n = int(n)
    return n if lo <= n <= hi else None


def _short_label(v) -> str | None:
    s = str(v).strip()[:20] if v is not None else ""
    return s or None


def _validate_ratio_icons(raw: dict) -> dict | None:
    values = raw.get("values")
    if not isinstance(values, list) or len(values) != 2:
        return None
    a, b = (_num(x, 1, MAX_RATIO_VALUE) for x in values)
    if a is None or b is None:
        return None
    labels = raw.get("labels")
    if not isinstance(labels, list) or len(labels) != 2:
        labels = ["প্রথম দল", "দ্বিতীয় দল"]
    la, lb = (_short_label(x) for x in labels)
    if not la or not lb:
        la, lb = "প্রথম দল", "দ্বিতীয় দল"
    return {"type": "ratio_icons", "values": [a, b], "labels": [la, lb]}


def _validate_percent_grid(raw: dict) -> dict | None:
    p = _num(raw.get("percent"), 0, 100, integer=False)
    if p is None:
        return None
    return {"type": "percent_grid", "percent": round(p, 1)}


def _validate_fraction_split(raw: dict) -> dict | None:
    d = _num(raw.get("denominator"), 2, 12)
    if d is None:
        return None
    n = _num(raw.get("numerator"), 0, max(d * 3, 12))     # allow mild improper fractions (e.g. 5/4)
    if n is None:
        return None
    return {"type": "fraction_split", "numerator": n, "denominator": d}


def _validate_exponent_stack(raw: dict) -> dict | None:
    base = _num(raw.get("base"), 2, 12)
    exponent = _num(raw.get("exponent"), 2, 6)
    if base is None or exponent is None:
        return None
    return {"type": "exponent_stack", "base": base, "exponent": exponent}


def _validate_square_root_square(raw: dict) -> dict | None:
    n = _num(raw.get("n"), 1, 144)
    if n is None:
        return None
    root = int(round(n ** 0.5))
    if root * root != n:
        return None                   # only perfect squares unfold into a clean grid
    return {"type": "square_root_square", "n": n}


def _validate_area_grid(raw: dict) -> dict | None:
    rows = _num(raw.get("rows"), 1, MAX_GRID_SIZE)
    cols = _num(raw.get("cols"), 1, MAX_GRID_SIZE)
    if rows is None or cols is None:
        return None
    return {"type": "area_grid", "rows": rows, "cols": cols}


def _validate_equation_balance(raw: dict) -> dict | None:
    def side(key):
        items = raw.get(key)
        if not isinstance(items, list) or not (1 <= len(items) <= MAX_EQUATION_TERMS):
            return None
        out = []
        for it in items:
            if isinstance(it, str) and it.strip().lower() == "x":
                out.append("x")
            else:
                n = _num(it, -99, 99)
                if n is None:
                    return None
                out.append(n)
        return out
    left, right = side("left"), side("right")
    if left is None or right is None:
        return None
    if not any(t == "x" for t in left + right):
        return None                   # not worth a balance diagram without an unknown
    return {"type": "equation_balance", "left": left, "right": right}


_SHAPES = {"triangle", "rectangle", "circle"}
_AXES = {"vertical", "horizontal"}


def _validate_symmetry_mirror(raw: dict) -> dict | None:
    shape = str(raw.get("shape", "")).strip().lower()
    axis = str(raw.get("axis", "")).strip().lower()
    if shape not in _SHAPES or axis not in _AXES:
        return None
    return {"type": "symmetry_mirror", "shape": shape, "axis": axis}


DIAGRAM_TYPES: dict[str, dict] = {
    "ratio_icons": {
        "validator": _validate_ratio_icons,
        "when": "দুটি রাশির অনুপাত তুলনা করার সময় (যেমন ছেলে ও মেয়ের সংখ্যা ৩:২)",
        "fields": '{"type":"ratio_icons","values":[৩,২],"labels":["ছেলে","মেয়ে"]}  -- values দুটি ছোট ধনাত্মক পূর্ণসংখ্যা (সর্বোচ্চ ১২)',
    },
    "percent_grid": {
        "validator": _validate_percent_grid,
        "when": "শতকরা হিসাব বোঝাতে",
        "fields": '{"type":"percent_grid","percent":৩০}  -- percent ০ থেকে ১০০',
    },
    "fraction_split": {
        "validator": _validate_fraction_split,
        "when": "ভগ্নাংশ বোঝাতে",
        "fields": '{"type":"fraction_split","numerator":৩,"denominator":৪}  -- denominator ২ থেকে ১২',
    },
    "exponent_stack": {
        "validator": _validate_exponent_stack,
        "when": "সূচক/ঘাত (বারবার গুণ) বোঝাতে",
        "fields": '{"type":"exponent_stack","base":২,"exponent":৩}  -- base ২-১২, exponent ২-৬',
    },
    "square_root_square": {
        "validator": _validate_square_root_square,
        "when": "বর্গমূল বোঝাতে, শুধু তখনই যখন সংখ্যাটি পূর্ণবর্গ (৪,৯,১৬,২৫,৩৬,৪৯,৬৪,৮১,১০০,১২১,১৪৪)",
        "fields": '{"type":"square_root_square","n":৩৬}',
    },
    "area_grid": {
        "validator": _validate_area_grid,
        "when": "আয়তক্ষেত্র/বর্গক্ষেত্রের ক্ষেত্রফল গণনা একক বর্গ দিয়ে বোঝাতে",
        "fields": '{"type":"area_grid","rows":৪,"cols":৫}  -- প্রতিটি সর্বোচ্চ ১০',
    },
    "equation_balance": {
        "validator": _validate_equation_balance,
        "when": "এক চলবিশিষ্ট সরল সমীকরণ বোঝাতে (যেমন 2x + 3 = 11)",
        "fields": '{"type":"equation_balance","left":[২,"x",৩],"right":[১১]}  -- প্রতিটি পদ সংখ্যা অথবা "x", সর্বোচ্চ ৫টি পদ প্রতি পাশে',
    },
    "symmetry_mirror": {
        "validator": _validate_symmetry_mirror,
        "when": "প্রতিসাম্য (রৈখিক) বোঝাতে",
        "fields": '{"type":"symmetry_mirror","shape":"triangle","axis":"vertical"}  -- shape: triangle/rectangle/circle, axis: vertical/horizontal',
    },
}


def catalog_prompt_text() -> str:
    """The catalog description embedded in the classification prompt."""
    lines = []
    for name, spec in DIAGRAM_TYPES.items():
        lines.append(f"- {name}: {spec['when']}\n  ফরম্যাট: {spec['fields']}")
    return "\n".join(lines)


def validate_diagram(raw) -> dict | None:
    """raw is whatever the model (or an admin edit) produced for one example's
    "diagram" field. Returns a normalized, bounds-checked spec, or None if it
    doesn't validate -- callers treat None as "no diagram for this example",
    never as an error that blocks the rest of the lesson."""
    if not isinstance(raw, dict):
        return None
    dtype = raw.get("type")
    spec = DIAGRAM_TYPES.get(dtype)
    if not spec:
        return None
    return spec["validator"](raw)
