import pytest

from diagram_spec import DIAGRAM_TYPES, catalog_prompt_text, validate_diagram


def test_unknown_or_malformed_input_is_none():
    assert validate_diagram(None) is None
    assert validate_diagram("not a dict") is None
    assert validate_diagram({}) is None
    assert validate_diagram({"type": "not_a_real_type"}) is None


class TestRatioIcons:
    def test_valid(self):
        d = validate_diagram({"type": "ratio_icons", "values": [3, 2], "labels": ["ছেলে", "মেয়ে"]})
        assert d == {"type": "ratio_icons", "values": [3, 2], "labels": ["ছেলে", "মেয়ে"]}

    def test_missing_labels_gets_a_sane_default(self):
        d = validate_diagram({"type": "ratio_icons", "values": [3, 2]})
        assert d["labels"] == ["প্রথম দল", "দ্বিতীয় দল"]

    @pytest.mark.parametrize("values", [[3], [3, 2, 1], ["a", 2], [0, 2], [13, 2], None])
    def test_rejects_bad_values(self, values):
        assert validate_diagram({"type": "ratio_icons", "values": values}) is None


class TestPercentGrid:
    @pytest.mark.parametrize("p,expected", [(30, 30), (0, 0), (100, 100), (33.3, 33.3)])
    def test_valid(self, p, expected):
        assert validate_diagram({"type": "percent_grid", "percent": p}) == {"type": "percent_grid", "percent": expected}

    @pytest.mark.parametrize("p", [-1, 101, "half", None])
    def test_rejects_out_of_range(self, p):
        assert validate_diagram({"type": "percent_grid", "percent": p}) is None


class TestFractionSplit:
    def test_valid_proper_fraction(self):
        assert validate_diagram({"type": "fraction_split", "numerator": 3, "denominator": 4}) == \
            {"type": "fraction_split", "numerator": 3, "denominator": 4}

    def test_mildly_improper_fraction_allowed(self):
        assert validate_diagram({"type": "fraction_split", "numerator": 5, "denominator": 4}) is not None

    @pytest.mark.parametrize("n,d", [(3, 1), (3, 13), (-1, 4), (3, 0)])
    def test_rejects(self, n, d):
        assert validate_diagram({"type": "fraction_split", "numerator": n, "denominator": d}) is None


class TestExponentStack:
    def test_valid(self):
        assert validate_diagram({"type": "exponent_stack", "base": 2, "exponent": 3}) == \
            {"type": "exponent_stack", "base": 2, "exponent": 3}

    @pytest.mark.parametrize("base,exp", [(1, 3), (13, 3), (2, 1), (2, 7), (2, "x")])
    def test_rejects_out_of_renderable_bounds(self, base, exp):
        assert validate_diagram({"type": "exponent_stack", "base": base, "exponent": exp}) is None


class TestSquareRootSquare:
    @pytest.mark.parametrize("n", [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144])
    def test_perfect_squares_accepted(self, n):
        assert validate_diagram({"type": "square_root_square", "n": n}) == {"type": "square_root_square", "n": n}

    @pytest.mark.parametrize("n", [2, 10, 50, 150, -4])
    def test_non_perfect_squares_rejected(self, n):
        """Not just a bounds check: an unfold diagram for a non-perfect-square
        would be a wrong, confusing picture, not merely an out-of-range one."""
        assert validate_diagram({"type": "square_root_square", "n": n}) is None


class TestAreaGrid:
    def test_valid(self):
        assert validate_diagram({"type": "area_grid", "rows": 4, "cols": 5}) == \
            {"type": "area_grid", "rows": 4, "cols": 5}

    @pytest.mark.parametrize("rows,cols", [(0, 5), (11, 5), (4, 11)])
    def test_rejects_unrenderable_sizes(self, rows, cols):
        assert validate_diagram({"type": "area_grid", "rows": rows, "cols": cols}) is None


class TestEquationBalance:
    def test_valid_2x_plus_3_equals_11(self):
        d = validate_diagram({"type": "equation_balance", "left": [2, "x", 3], "right": [11]})
        assert d == {"type": "equation_balance", "left": [2, "x", 3], "right": [11]}

    def test_case_insensitive_x(self):
        d = validate_diagram({"type": "equation_balance", "left": ["X"], "right": [5]})
        assert d["left"] == ["x"]

    def test_rejects_when_neither_side_has_an_unknown(self):
        """A balance with only numbers on both sides isn't an equation worth
        illustrating this way -- nothing to solve for."""
        assert validate_diagram({"type": "equation_balance", "left": [5], "right": [5]}) is None

    @pytest.mark.parametrize("left,right", [
        ([], [11]), ([1, 2, 3, 4, 5, "x"], [11]), (["x", "banana"], [11]), (None, [11]),
    ])
    def test_rejects_malformed_sides(self, left, right):
        assert validate_diagram({"type": "equation_balance", "left": left, "right": right}) is None


class TestSymmetryMirror:
    @pytest.mark.parametrize("shape,axis", [("triangle", "vertical"), ("rectangle", "horizontal"), ("circle", "vertical")])
    def test_valid(self, shape, axis):
        assert validate_diagram({"type": "symmetry_mirror", "shape": shape, "axis": axis}) == \
            {"type": "symmetry_mirror", "shape": shape, "axis": axis}

    @pytest.mark.parametrize("shape,axis", [("pentagon", "vertical"), ("triangle", "diagonal")])
    def test_rejects_shapes_outside_the_fixed_vocabulary(self, shape, axis):
        """The shape vocabulary is deliberately small and fixed -- a freeform
        shape name would have nothing reliable to render."""
        assert validate_diagram({"type": "symmetry_mirror", "shape": shape, "axis": axis}) is None


def test_catalog_prompt_text_documents_every_registered_type():
    text = catalog_prompt_text()
    for name in DIAGRAM_TYPES:
        assert name in text


def test_every_type_has_a_validator_and_prompt_fields():
    for name, spec in DIAGRAM_TYPES.items():
        assert callable(spec["validator"]), name
        assert spec["when"] and spec["fields"], name
