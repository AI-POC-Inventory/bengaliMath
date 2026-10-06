"""Lesson content -> a narrated slide deck script.

Pure and dependency-free: takes the same LessonContent shape approved lessons
already store (service/db/lesson_generator.py's validate_content output) and
turns it into an ordered list of slides, each with what's shown on screen and
what the narrator says. No LLM call here -- the video's script is the already-
reviewed, already worked-example-verified lesson text; this module only
re-shapes it for video pacing, it never invents new wording.

Deliberately excluded: quickCheck. It's an interactive "try it yourself,
reveal the answer" element that only makes sense on a page a student can pause
and think on -- a passive video would either race past it or narrate an
anticlimactic Q&A. It stays a text-lesson-only feature.

Each slide:
  {
    "kind":      "title" | "overview" | "section_title" | "explanation" |
                 "key_points" | "example" | "common_mistakes" | "takeaway" |
                 "closing",
    "heading":   str,                 # shown at the top of the slide
    "body":      [str, ...],          # lines/bullets shown on the slide
    "narration": str,                 # what TTS reads for this slide
  }

A slide's on-screen duration is not decided here -- it is however long its own
narration audio takes once synthesized (see tts.py / render.py). That keeps
narration and visuals inherently in sync without a separate timing model.
"""
from __future__ import annotations

import re

MAX_NARRATION_CHARS = 900          # keeps each Cloud TTS request comfortably
                                    # under its per-request limit and each
                                    # slide's audio to a reasonable length

_SENTENCE_SPLIT = re.compile(r"(?<=[।.!?])\s+")


def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in (text or "").split("\n\n") if p.strip()]


def _split_into_units(text: str) -> list[str]:
    """Paragraphs (blank-line separated) are the preferred grouping unit --
    that's the "2 to 4 short paragraphs" shape the lesson generator's own
    prompt asks for. But lesson content can also be hand-edited as free text
    (LessonGenerator.tsx's textarea has no length limit), so a paragraph that
    alone exceeds MAX_NARRATION_CHARS is additionally split on sentence
    boundaries -- otherwise a single unbroken block of text would produce one
    slide with an unreasonably long narration regardless of how MAX_NARRATION_CHARS
    is set."""
    units = []
    for para in _split_paragraphs(text):
        if len(para) <= MAX_NARRATION_CHARS:
            units.append(para)
        else:
            units.extend(s.strip() for s in _SENTENCE_SPLIT.split(para) if s.strip())
    return units


def _chunk(items: list[str], max_chars: int) -> list[list[str]]:
    """Group consecutive short items so a chunk's joined text stays under
    max_chars, without ever splitting a single item (a slide's own text is
    never truncated, only how many share a slide)."""
    chunks: list[list[str]] = []
    current: list[str] = []
    length = 0
    for item in items:
        added = len(item) + 1
        if current and length + added > max_chars:
            chunks.append(current)
            current, length = [], 0
        current.append(item)
        length += added
    if current:
        chunks.append(current)
    return chunks


def _example_narration(ex: dict) -> str:
    parts = [f"সমস্যা: {ex['problem']}"]
    for i, step in enumerate(ex.get("steps") or [], start=1):
        parts.append(f"ধাপ {i}। {step}")
    if ex.get("answer"):
        parts.append(f"উত্তর: {ex['answer']}")
    return " ".join(parts)


def _example_body(ex: dict) -> list[str]:
    body = [ex["problem"]]
    body.extend(f"{i}. {s}" for i, s in enumerate(ex.get("steps") or [], start=1))
    if ex.get("answer"):
        body.append(f"উত্তর: {ex['answer']}")
    return body


def build_script(chapter_name: str, lesson: dict) -> list[dict]:
    slides: list[dict] = [{
        "kind": "title", "heading": chapter_name, "body": [],
        "narration": f"অধ্যায়: {chapter_name}।",
    }]

    if lesson.get("overview"):
        body = [lesson["overview"]]
        narration = lesson["overview"]
        if lesson.get("prerequisites"):
            body.append("শুরুর আগে জেনে নাও: " + ", ".join(lesson["prerequisites"]))
            narration += " শুরুর আগে জেনে নেওয়া ভালো: " + ", ".join(lesson["prerequisites"]) + "।"
        slides.append({"kind": "overview", "heading": "এই অধ্যায়ে কী শিখব", "body": body, "narration": narration})

    for section in lesson.get("sections") or []:
        title = section["title"]
        slides.append({"kind": "section_title", "heading": title, "body": [], "narration": title + "।"})

        for chunk in _chunk(_split_into_units(section.get("explanation", "")), MAX_NARRATION_CHARS):
            slides.append({
                "kind": "explanation", "heading": title,
                "body": chunk, "narration": " ".join(chunk),
            })

        if section.get("keyPoints"):
            slides.append({
                "kind": "key_points", "heading": f"{title} — মনে রাখো",
                "body": list(section["keyPoints"]),
                "narration": "মনে রাখো। " + " ".join(section["keyPoints"]),
            })

        for i, ex in enumerate(section.get("examples") or [], start=1):
            # diagram is already validated by service/db/diagram_spec.py at
            # lesson-approval time (see lesson_generator.py's validate_content);
            # trusted as-is here, same as every other already-approved field.
            slides.append({
                "kind": "example", "heading": f"{title} — উদাহরণ {i}",
                "body": _example_body(ex), "narration": _example_narration(ex),
                "diagram": ex.get("diagram"),
            })

        if section.get("commonMistakes"):
            slides.append({
                "kind": "common_mistakes", "heading": f"{title} — সাধারণ ভুল",
                "body": list(section["commonMistakes"]),
                "narration": "সাধারণ ভুল যা এড়িয়ে চলবে। " + " ".join(section["commonMistakes"]),
            })

        if section.get("takeaway"):
            slides.append({
                "kind": "takeaway", "heading": f"{title} — মূল কথা",
                "body": [section["takeaway"]], "narration": section["takeaway"],
            })

    slides.append({
        "kind": "closing", "heading": "অনুশীলন করো", "body": [],
        "narration": "এই অধ্যায়ের পাঠ শেষ হলো। এখন অনুশীলনী পাতায় গিয়ে নিজে অনুশীলন করো।",
    })

    # Defensive: MAX_NARRATION_CHARS already bounds explanation slides; a very
    # long single example or key-point list could still exceed it since those
    # are never split mid-item. Cloud TTS's own limit is generous (~5000 bytes)
    # so this is a soft safety margin, not expected to trigger in practice.
    for s in slides:
        if len(s["narration"]) > MAX_NARRATION_CHARS * 2:
            raise ValueError(f"slide narration too long ({len(s['narration'])} chars): {s['heading']!r}")

    return slides
