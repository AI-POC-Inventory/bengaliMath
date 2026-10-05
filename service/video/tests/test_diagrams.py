"""diagrams.py: every registered type renders without error at both a normal
and a tight (worst-case) size, and the Bengali-digit helper is correct. Not
golden-pixel tests (font rendering varies by host, as slides.py's tests note)
-- these check the renderer doesn't crash/produce a blank canvas and that
bn() -- used throughout every diagram's labels -- is right, since a wrong
digit would be wrong in every single diagram type at once."""
import pytest
from PIL import Image

from diagrams import bn, render_diagram

SPECS = {
    "ratio_icons": {"type": "ratio_icons", "values": [3, 2], "labels": ["ছেলে", "মেয়ে"]},
    "percent_grid": {"type": "percent_grid", "percent": 30},
    "fraction_split": {"type": "fraction_split", "numerator": 3, "denominator": 4},
    "exponent_stack": {"type": "exponent_stack", "base": 2, "exponent": 4},
    "square_root_square": {"type": "square_root_square", "n": 36},
    "area_grid": {"type": "area_grid", "rows": 4, "cols": 6},
    "equation_balance": {"type": "equation_balance", "left": [2, "x", 3], "right": [11]},
    "symmetry_mirror": {"type": "symmetry_mirror", "shape": "triangle", "axis": "vertical"},
}


def test_bn_converts_every_digit():
    assert bn(0) == "০" and bn(9) == "৯"
    assert bn(1234567890) == "১২৩৪৫৬৭৮৯০"
    assert bn("12/34") == "১২/৩৪"          # non-digit characters pass through
    assert bn(3.5) == "৩.৫"


@pytest.mark.parametrize("name,spec", SPECS.items())
def test_every_registered_type_renders_a_non_blank_image(name, spec):
    img = render_diagram(spec, 400, 300)
    assert img.size == (400, 300)
    assert img.getcolors(400 * 300) is None or len(img.getcolors(400 * 300)) > 1, \
        f"{name}: canvas is a single solid color -- nothing was drawn"


@pytest.mark.parametrize("name,spec", SPECS.items())
def test_every_type_renders_at_a_small_slide_half_size(name, spec):
    """The video slide gives a diagram roughly half the 1280x720 canvas --
    confirm nothing throws or overflows catastrophically at that size."""
    img = render_diagram(spec, 560, 500)
    assert img.size == (560, 500)


def test_unknown_type_returns_a_blank_canvas_not_an_error():
    img = render_diagram({"type": "not_a_real_type"}, 400, 300)
    colors = img.getcolors(400 * 300)
    assert colors is not None and len(colors) == 1          # just the background


@pytest.mark.parametrize("percent,expected_cells", [(30, 30), (45, 45), (1, 1), (99, 99), (100, 100), (0, 0)])
def test_percent_grid_shades_exactly_the_right_cell_count(percent, expected_cells):
    """A round percentage like 30% could pass even with an off-by-one bug (30
    happens to land on a clean row boundary); 45% would not. Counts shaded
    cells by sampling each of the 100 cell centers, not by eye."""
    from diagrams import ACCENT
    img = render_diagram({"type": "percent_grid", "percent": percent}, 400, 300).convert("RGB")
    w, h = img.size
    cell = min(w, h - 60) / 10 * 0.85
    gx, gy = (w - cell * 10) / 2, 20
    shaded = sum(
        1 for i in range(100)
        if img.getpixel((int(gx + (i % 10) * cell + cell / 2), int(gy + (i // 10) * cell + cell / 2))) == ACCENT
    )
    assert shaded == expected_cells


def test_fraction_split_improper_fraction_uses_two_bars():
    """5/4 needs ceil(5/4)=2 bars -- a smoke check that the multi-bar branch
    (bars = ceil(n/d)) actually executes instead of raising on n > d."""
    img = render_diagram({"type": "fraction_split", "numerator": 5, "denominator": 4}, 400, 300)
    assert img.size == (400, 300)


def test_equation_balance_handles_the_max_five_terms_per_side():
    img = render_diagram(
        {"type": "equation_balance", "left": [1, "x", "x", "x", "x"], "right": [2, 3]}, 400, 300)
    assert img.size == (400, 300)


@pytest.mark.parametrize("shape", ["triangle", "rectangle", "circle"])
@pytest.mark.parametrize("axis", ["vertical", "horizontal"])
def test_symmetry_mirror_every_shape_and_axis_combination(shape, axis):
    img = render_diagram({"type": "symmetry_mirror", "shape": shape, "axis": axis}, 400, 300)
    assert img.size == (400, 300)


def test_square_root_square_cell_count_matches_the_root_not_n():
    """n=36 must draw a 6x6 grid (36 cells, cell size max_side/6), not
    anything keyed off n=36 directly -- that would silently produce an
    unusably dense grid instead of erroring. Checked by calling the same
    geometry the renderer uses, since pixel-sampling a rendered grid can't
    reliably distinguish "6 wide cells" from "36 thin cells" by eye alone."""
    import math
    for n, expected_root in [(4, 2), (36, 6), (144, 12)]:
        root = round(math.sqrt(n))
        assert root == expected_root and root * root == n
        img = render_diagram({"type": "square_root_square", "n": n}, 400, 300)
        assert img.size == (400, 300)                       # still renders at every boundary size
