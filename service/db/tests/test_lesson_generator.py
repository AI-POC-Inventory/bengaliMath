"""Lesson generator: validation, the LLM pipeline (with a fake LLM) and the
review workflow (with an in-memory fake table). No network, no credentials."""
import json
import types

import pytest

import lesson_generator as lg
from question_generator import GenerationError


# ── validate_content ─────────────────────────────────────────────────────

GOOD = {
    "overview": " hi ", "prerequisites": "a\n\nb",
    "sections": [{
        "title": "T", "explanation": "E", "keyPoints": ["k", "", None],
        "examples": [{"problem": "p", "steps": "s1\ns2", "answer": "a", "verified": "yes"}, {"problem": ""}, "junk"],
        "quickCheck": [{"question": "q", "answer": "a"}, {"question": ""}], "takeaway": "t",
    }],
}


def test_validate_normalizes():
    c = lg.validate_content(GOOD)
    s = c["sections"][0]
    assert c["overview"] == "hi" and c["prerequisites"] == ["a", "b"] and c["version"] == 1
    assert s["keyPoints"] == ["k"]
    assert len(s["examples"]) == 1 and s["examples"][0]["steps"] == ["s1", "s2"]
    assert s["examples"][0]["verified"] is None                  # non-bool coerced to unchecked
    assert len(s["quickCheck"]) == 1


def test_validate_is_idempotent_for_edit_round_trips():
    c = lg.validate_content(GOOD)
    assert lg.validate_content(json.loads(json.dumps(c))) == c


@pytest.mark.parametrize("bad", [
    None, [], {}, {"sections": []}, {"sections": ["x"]}, {"sections": [{"title": "T"}]},
    {"sections": [{"title": "T", "explanation": "E"}] * 13},
])
def test_validate_rejects_bad_shapes(bad):
    with pytest.raises(GenerationError) as e:
        lg.validate_content(bad)
    assert e.value.status == 400


@pytest.mark.parametrize("chunk_id", [
    "c7.ch03.p46.322", "c7.ch02.2.235", "c7.ch16.16.(c)", "c7.ch01.1.2.1(iv)", "c7.ch03.p55.13.",
])
@pytest.mark.parametrize("template", [
    "নিয়ম ({}) এবং", "নিয়ম [{}]।", "শেষ ({})", "দুটি ({0}, {0}) একসাথে।", "বন্ধনী ছাড়া {} এখানে।",
])
def test_leaked_chunk_ids_are_stripped(chunk_id, template):
    out = lg.strip_refs(template.format(chunk_id))
    assert "c7.ch" not in out and "()" not in out and "[]" not in out


def test_strip_refs_leaves_normal_text_alone():
    for text in ["(৩ + ৪) × ২ = 14", "উত্তর (ক) সঠিক", "[১, ২, ৩]", "চিত্র (i) থেকে",
                 "c = 5 এবং d = 6", "সূত্র (a + b)² = a² + 2ab + b²"]:
        assert lg.strip_refs(text) == text


def test_refs_are_stripped_from_generated_and_edited_content():
    dirty = {"overview": "ভূমিকা (c7.ch02.2.235)", "sections": [{
        "title": "T", "explanation": "নিয়ম (c7.ch03.p49.11)। শেষ",
        "keyPoints": ["পদ [c7.ch03.p48.10]"],
        "examples": [{"problem": "p (c7.ch01.1.2.1(iv))", "steps": ["ধাপ (c7.ch03.p49.11)"], "answer": "1"}]}]}
    c = lg.validate_content(dirty)
    assert "c7.ch" not in json.dumps(c, ensure_ascii=False)
    assert c["sections"][0]["explanation"] == "নিয়ম। শেষ"


def test_section_prompt_carries_position_outline_and_no_greeting_rule():
    prompt = lg._section_prompt("Ch", "T2", "f", "ctx", index=2, outline=["T1", "T2", "T3"])
    assert "2/3 নম্বর অংশ" in prompt
    assert all(t in prompt for t in ("1. T1", "2. T2", "3. T3"))
    assert "অভিবাদন বা স্বাগত" in prompt                       # no greeting
    assert "পরের অংশগুলোতে" in prompt                          # no forward references
    assert "c7.ch02" in prompt                                # tells the model not to echo chunk ids


def test_loads_tolerates_surrounding_text():
    assert lg._loads('{"a":1}') == {"a": 1}
    assert lg._loads('noise {"a":1} tail') == {"a": 1}
    assert lg._loads("x [1,2] y") == [1, 2]
    assert lg._loads("garbage") is None and lg._loads(None) is None


# ── build_lesson with a fake LLM ─────────────────────────────────────────

@pytest.fixture
def fake_llm(monkeypatch):
    calls = {"outline": 0, "section": 0, "verify": 0}
    monkeypatch.setattr(lg, "retrieve_context",
                        lambda topic, nos, top_k=20: (f"ctx:{topic['name']}", [f"{topic['name']}#1", "shared"]))

    def llm(prompt, temperature=0.8, model=None):
        if "পাঠ পরিকল্পনা" in prompt:
            calls["outline"] += 1
            return json.dumps({"overview": "ov", "prerequisites": ["pre"], "sections": [
                {"title": "S1", "focus": "f1"}, {"title": "S2", "focus": "f2"}, {"title": "BAD", "focus": "f3"}]})
        if "claimedAnswer" in prompt:
            calls["verify"] += 1
            items = json.loads(prompt[prompt.index("["):prompt.index("]\n\nশুধু") + 1])
            return json.dumps([{"i": it["i"], "myAnswer": "x", "matches": it["i"] != 1} for it in items])
        calls["section"] += 1
        title = prompt.split("অংশ: ")[1].split(" - ")[0]
        if title == "BAD":
            return "not json at all"
        return json.dumps({"title": title, "explanation": "e", "examples": [
            {"problem": f"{title}-p1", "steps": ["a"], "answer": "1"},
            {"problem": f"{title}-p2", "steps": ["b"], "answer": "2"}]})

    monkeypatch.setattr(lg, "_call_gemini", llm)
    return calls, llm


def test_pipeline_outline_sections_verify(fake_llm):
    calls, _ = fake_llm
    content, ids = lg.build_lesson("Ch", [2, 3])
    assert [s["title"] for s in content["sections"]] == ["S1", "S2"]        # failing section skipped
    assert calls["outline"] == 1 and calls["verify"] == 1
    assert calls["section"] == 2 + 2                                         # S1, S2 once; BAD twice (one retry)
    flags = [e["verified"] for s in content["sections"] for e in s["examples"]]
    assert flags == [True, False, True, True]                               # the mismatch is flagged
    assert ids.count("shared") == 1 and ids[0] == "Ch#1"                     # de-duplicated, order kept


def test_no_outline_is_a_502(monkeypatch, fake_llm):
    monkeypatch.setattr(lg, "_call_gemini", lambda *a, **k: "nope")
    with pytest.raises(GenerationError) as e:
        lg.build_lesson("Ch", [2])
    assert e.value.status == 502


def test_verification_outage_leaves_examples_unchecked(monkeypatch, fake_llm):
    _, llm = fake_llm
    monkeypatch.setattr(lg, "_call_gemini",
                        lambda prompt, temperature=0.8, model=None: "nope" if "claimedAnswer" in prompt else llm(prompt))
    content, _ = lg.build_lesson("Ch", [2])
    assert all(e["verified"] is None for s in content["sections"] for e in s["examples"])


# ── Review workflow against an in-memory table ───────────────────────────

class _Table:
    def __init__(self, db):
        self.db, self.filters, self.op, self.payload, self.ordering = db, [], "select", None, None

    def select(self, *a): self.op = "select"; return self
    def insert(self, row): self.op, self.payload = "insert", row; return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def eq(self, key, value): self.filters.append((key, value)); return self
    def order(self, col, desc=False): self.ordering = (col, desc); return self
    def limit(self, *a): return self

    def execute(self):
        if self.op == "insert":
            self.db.append(dict(self.payload))
            return types.SimpleNamespace(data=[dict(self.payload)])
        rows = [r for r in self.db if all(r.get(k) == v for k, v in self.filters)]
        if self.op == "update":
            for r in rows:
                r.update(self.payload)
        if self.ordering:
            rows = sorted(rows, key=lambda r: r[self.ordering[0]], reverse=self.ordering[1])
        return types.SimpleNamespace(data=[dict(r) for r in rows])


@pytest.fixture
def db(monkeypatch):
    rows = []
    monkeypatch.setattr(lg, "supabase", types.SimpleNamespace(
        table=lambda name: _Table(rows),
        rpc=lambda name, params: types.SimpleNamespace(
            execute=lambda: types.SimpleNamespace(data={"ok": True, "called": name, **params}))))
    return rows


def test_versions_increment_per_chapter(db):
    c = lg.validate_content(GOOD)
    a = lg._insert_draft(7, "7-5", c, ["x"], "m")
    b = lg._insert_draft(7, "7-5", c, None, None)
    other = lg._insert_draft(7, "7-6", c, None, None)
    assert (a["version"], b["version"], other["version"]) == (1, 2, 1) and a["status"] == "draft"


def test_only_drafts_are_editable_and_content_is_validated(db):
    c = lg.validate_content(GOOD)
    d = lg._insert_draft(7, "7-5", c, None, None)
    edited = dict(c, overview="edited")
    assert lg.update_lesson(d["id"], edited)["content"]["overview"] == "edited"
    with pytest.raises(GenerationError) as e:
        lg.update_lesson(d["id"], {"sections": []})
    assert e.value.status == 400

    assert lg.reject_lesson(d["id"])["status"] == "rejected"
    for action in (lg.reject_lesson, lambda i: lg.update_lesson(i, c)):
        with pytest.raises(GenerationError) as e:
            action(d["id"])
        assert e.value.status == 409


def test_clone_creates_next_draft_with_same_content(db):
    c = lg.validate_content(GOOD)
    lg._insert_draft(7, "7-5", c, None, None)
    second = lg._insert_draft(7, "7-5", c, None, None)
    clone = lg.clone_lesson(second["id"])
    assert clone["status"] == "draft" and clone["version"] == 3 and clone["content"] == c


def test_approve_and_unpublish_use_the_atomic_functions(db):
    c = lg.validate_content(GOOD)
    d = lg._insert_draft(7, "7-5", c, None, None)
    assert lg.approve_lesson(d["id"])["called"] == "approve_lesson"
    assert lg.unpublish_lesson("7-5") == {"ok": True, "called": "unpublish_lesson", "p_chapter_id": "7-5"}


def test_unknown_lesson_is_404(db):
    with pytest.raises(GenerationError) as e:
        lg.get_lesson("nope")
    assert e.value.status == 404
