"""Text folding for lexical matching. Bengali-aware."""
import re
import unicodedata

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\ufeff"))
KEEP = set(":/%.-")


def fold(text: str) -> str:
    r"""Folded form for BM25. Keeps letters, digits and combining marks;
    everything else becomes a space. Never shown to a user.

    Do NOT replace this with re.sub(r"[^\w\s:/%.-]", " ", t): Python's \w
    excludes Unicode combining marks, and Bengali vowel signs and the virama
    ARE combining marks -- that regex turns গ্রামের into গ র ম র, shattering
    every word into bare consonants with no error raised.
    """
    t = unicodedata.normalize("NFC", text)
    t = t.translate(ZERO_WIDTH)
    t = t.translate(BN_DIGITS)
    out = [
        ch if unicodedata.category(ch)[0] in "LNM" or ch in KEEP else " "
        for ch in t
    ]
    return re.sub(r"\s+", " ", "".join(out)).strip().lower()


def tokens(text: str) -> list[str]:
    return fold(text).split()
