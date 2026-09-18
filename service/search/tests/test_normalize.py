"""fold() is the lexical arm's tokeniser. Two regressions live here."""
import unicodedata

from normalize import fold, tokens


def test_bengali_conjuncts_survive():
    r"""The obvious re.sub(r"[^\w\s:/%.-]", " ", t) is silently catastrophic:
    Python's \w excludes Unicode combining marks, and Bengali vowel signs and
    the virama ARE combining marks -- that regex shatters গ্রামের into bare
    consonants with no error raised."""
    assert "গ্রামের" in fold("840 গ্রামের 30%")
    assert "পার্ক" in fold("৭৭/২ পার্ক স্ট্রিট")
    assert "স্ট্রিট" in fold("৭৭/২ পার্ক স্ট্রিট")


def test_bengali_and_latin_numerals_fold_together():
    """The book writes prose numbers in Bengali digits and every mathematical
    expression in Latin digits. A student typing either must hit both."""
    assert fold("৮৪০ গ্রামের ৩০%") == fold("840 গ্রামের 30%")
    assert fold("২০১১ সালে").startswith("2011")


def test_notation_and_ids_are_preserved():
    assert fold("5 : 7 :: 10 : 14") == "5 : 7 :: 10 : 14"
    assert "1.2" in tokens("কষে দেখি — 1.2")
    assert fold("নিজে করি-3.2") == "নিজে করি-3.2"


def test_punctuation_and_zero_width_are_dropped():
    assert "।" not in fold("দেখি।")
    assert fold("দেখি\u200c\u200d") == "দেখি"
    assert fold("কষে দেখি — 1.2") == "কষে দেখি 1.2"


def test_output_is_nfc_normalised():
    out = fold("অধ্যায় : 3")
    assert out == unicodedata.normalize("NFC", out)
