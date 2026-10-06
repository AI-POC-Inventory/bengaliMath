import pytest

from script_builder import MAX_NARRATION_CHARS, build_script

LESSON = {
    "overview": "এই অধ্যায়ে আমরা অনুপাত শিখব।\n\nদৈনন্দিন জীবনে এটি কাজে লাগে।",
    "prerequisites": ["ভগ্নাংশ", "গুণ ও ভাগ"],
    "sections": [{
        "title": "অনুপাত কী",
        "explanation": "দুটি রাশির তুলনাকে অনুপাত বলে।\n\nযেমন ৩ এবং ৬ এর অনুপাত ১:২।",
        "keyPoints": ["অনুপাতের কোনো একক নেই।", "সরল অনুপাতে লেখা যায়।"],
        "examples": [{"problem": "১৫:২৫ কে সরল করো।",
                      "steps": ["গ.সা.গু বের করি: ৫", "উভয়কে ৫ দিয়ে ভাগ করি"], "answer": "৩:৫"}],
        "commonMistakes": ["একক না মেলানো।"],
        "quickCheck": [{"question": "৪:৮ সরল কর।", "answer": "১:২"}],
        "takeaway": "অনুপাত হলো তুলনা।",
    }],
}


def test_slide_order_and_kinds():
    kinds = [s["kind"] for s in build_script("অনুপাত ও সমানুপাত", LESSON)]
    assert kinds == [
        "title", "overview", "section_title", "explanation",
        "key_points", "example", "common_mistakes", "takeaway", "closing",
    ]


def test_quick_check_is_never_included():
    """Interactive reveal-the-answer content doesn't belong in a passive video."""
    script = build_script("Ch", LESSON)
    blob = str(script)
    assert "quickCheck" not in blob and "৪:৮" not in blob


def test_every_slide_has_narration_and_a_heading():
    for s in build_script("Ch", LESSON):
        assert s["heading"]
        assert s["narration"].strip()


def test_example_slide_carries_its_diagram_spec_through_untouched():
    """The diagram is already validated at lesson-approval time
    (lesson_generator.py); script_builder trusts it as-is, same as every
    other already-approved example field -- no re-validation here."""
    lesson = {"sections": [{"title": "T", "explanation": "E", "examples": [
        {"problem": "p", "answer": "a", "diagram": {"type": "ratio_icons", "values": [3, 2], "labels": ["ক", "খ"]}},
    ]}]}
    ex_slide = next(s for s in build_script("Ch", lesson) if s["kind"] == "example")
    assert ex_slide["diagram"] == {"type": "ratio_icons", "values": [3, 2], "labels": ["ক", "খ"]}


def test_example_slide_diagram_is_none_when_example_has_none():
    lesson = {"sections": [{"title": "T", "explanation": "E", "examples": [{"problem": "p", "answer": "a"}]}]}
    ex_slide = next(s for s in build_script("Ch", lesson) if s["kind"] == "example")
    assert ex_slide["diagram"] is None


def test_example_narration_includes_problem_steps_and_answer_in_order():
    script = build_script("Ch", LESSON)
    ex = next(s for s in script if s["kind"] == "example")
    narration = ex["narration"]
    assert narration.index("১৫:২৫") < narration.index("গ.সা.গু") < narration.index("৩:৫")
    assert ex["body"] == ["১৫:২৫ কে সরল করো।", "1. গ.সা.গু বের করি: ৫", "2. উভয়কে ৫ দিয়ে ভাগ করি", "উত্তর: ৩:৫"]


def test_no_overview_slide_when_lesson_has_none():
    lesson = {"sections": LESSON["sections"]}
    kinds = [s["kind"] for s in build_script("Ch", lesson)]
    assert "overview" not in kinds


def test_missing_optional_section_fields_produce_no_slide():
    bare = {"sections": [{"title": "T", "explanation": "E"}]}
    kinds = [s["kind"] for s in build_script("Ch", bare)]
    assert kinds == ["title", "section_title", "explanation", "closing"]


def test_long_explanation_is_chunked_not_truncated():
    long_para = "খুব দীর্ঘ একটি অনুচ্ছেদ। " * 60          # > MAX_NARRATION_CHARS
    lesson = {"sections": [{"title": "T", "explanation": long_para}]}
    script = build_script("Ch", lesson)
    explanation_slides = [s for s in script if s["kind"] == "explanation"]
    assert len(explanation_slides) >= 2
    # nothing lost: every word survives across the chunked slides, in order
    assert "".join(s["narration"] for s in explanation_slides).replace(" ", "") \
        == long_para.strip().replace(" ", "")
    for s in explanation_slides:
        assert len(s["narration"]) <= MAX_NARRATION_CHARS * 2


def test_multiple_short_paragraphs_share_a_slide():
    lesson = {"sections": [{"title": "T", "explanation": "এক।\n\nদুই।\n\nতিন।"}]}
    explanation_slides = [s for s in build_script("Ch", lesson) if s["kind"] == "explanation"]
    assert len(explanation_slides) == 1
    assert explanation_slides[0]["body"] == ["এক।", "দুই।", "তিন।"]


def test_overlong_single_item_raises_instead_of_silently_truncating():
    lesson = {"sections": [{"title": "T", "explanation": "E", "keyPoints": ["x" * (MAX_NARRATION_CHARS * 3)]}]}
    with pytest.raises(ValueError):
        build_script("Ch", lesson)


def test_chapter_name_appears_on_title_slide():
    script = build_script("সূচকের ধারণা", {"sections": []})
    assert script[0] == {"kind": "title", "heading": "সূচকের ধারণা", "body": [], "narration": "অধ্যায়: সূচকের ধারণা।"}
