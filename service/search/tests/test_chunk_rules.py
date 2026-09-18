"""The running-head filter, and the Unicode trap that made it silently fail."""
from chunk import is_running_head

PRECOMPOSED = "\u0985\u09a7\u09cd\u09af\u09be\u09df"          # অধ্যায়, U+09DF
DECOMPOSED = "\u0985\u09a7\u09cd\u09af\u09be\u09af\u09bc"     # অধ্যায়, য + ়


def test_both_unicode_forms_of_odhyay_match():
    """BENGALI LETTER YYA is a composition exclusion: the precomposed U+09DF
    and the decomposed য + ় pair are the same grapheme but compare unequal.
    The model returns one form, a source literal may hold the other. When this
    broke, every chapter title became the string "অধ্যায় : N"."""
    assert is_running_head(f"{PRECOMPOSED} : 1")
    assert is_running_head(f"{DECOMPOSED} : 1")


def test_running_head_variants():
    assert is_running_head(f"{PRECOMPOSED} : 16")
    assert is_running_head(f"{PRECOMPOSED} 16")
    assert is_running_head(f"  {PRECOMPOSED} : 3  ")
    assert is_running_head(f"{PRECOMPOSED} : ৩")       # Bengali numeral


def test_real_section_headers_are_not_running_heads():
    """These are the chunk boundaries -- dropping them would destroy parents."""
    for heading in ("কষে দেখি — 1.2", "নিজে করি-3.2", "3. সমানুপাত",
                    "8. ত্রিভুজ অঙ্কন", "বীজগণিতিক প্রক্রিয়া"):
        assert not is_running_head(heading), heading


def test_empty_and_none_are_safe():
    assert not is_running_head(None)
    assert not is_running_head("")
