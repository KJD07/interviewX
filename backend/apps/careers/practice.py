"""Zero-cost scoring of a typed practice answer against a question's ideal answer."""

import re

_STOP = set(
    "a an the and or but if then else of to in on at by for with from as is are was were be been being "
    "it its this that these those you your we our they their i he she him her them do does did done "
    "can could should would will shall may might must not no yes so such than too very just also "
    "into over under about between within without using use used which what when where who how why "
    "there here have has had get gets got make makes made one two more most some any all each other".split()
)
_WORD_RE = re.compile(r"[a-z0-9][a-z0-9+#.\-]*[a-z0-9+#]|[a-z0-9]")
MIN_WORDS_FOR_FULL_CREDIT = 25


def _stem(word: str) -> str:
    return word[:6]  # crude prefix stem: "caching"/"cached"/"cache" collide


def _key_terms(text: str) -> dict[str, str]:
    """stem -> original word, for significant (non-stopword, len>2) words."""
    terms: dict[str, str] = {}
    for w in _WORD_RE.findall(text.lower()):
        if w not in _STOP and len(w) > 2:
            terms.setdefault(_stem(w), w)
    return terms


def score_answer(answer: str, ideal_answer: str) -> dict:
    answer = (answer or "").strip()
    words = _WORD_RE.findall(answer.lower())
    ideal = _key_terms(ideal_answer)
    if not words or not ideal:
        return {"score": 0, "covered": [], "missing": sorted(ideal.values())[:12]}

    have = {_stem(w) for w in words}
    covered = [w for s, w in ideal.items() if s in have]
    missing = [w for s, w in ideal.items() if s not in have]
    coverage = len(covered) / len(ideal)

    score = min(10.0, coverage * 12.5)  # ~80% coverage of ideal terms = full marks
    if len(words) < MIN_WORDS_FOR_FULL_CREDIT:
        score = min(score, 1 + 5 * len(words) / MIN_WORDS_FOR_FULL_CREDIT)  # thin answers can't ace it
    return {"score": round(score, 1), "covered": covered[:15], "missing": missing[:12]}
