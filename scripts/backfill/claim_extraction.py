"""Independent-claim extraction from a patent's ``claims_text`` blob.

Shared by ``scripts/big-query-etl/etl.py`` (scheduled ingest) and
``scripts/backfill/backfill_patent_claims.py`` so both write identical
``patent_claim`` rows. Other scripts import this module, so keep it free of
import-time side effects.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class IndependentClaim:
    claim_number: int
    claim_text: str


# A claim starts at the beginning of a line with its number: "1. A method".
# BigQuery publications from 2025-12 onward put a space before the period
# ("1 . A method"), which the earlier "\d+\." pattern rejected.
CLAIM_START_RE = re.compile(r"(?m)^\s*(\d+)\s*\.\s")
# Canceled claim ranges, e.g. "1 - 20 . (canceled)" or "1 .- 20 . (canceled)".
# They end the preceding claim but are never emitted.
CLAIM_RANGE_RE = re.compile(r"(?m)^\s*\d+\s*\.?\s*-\s*\d+\s*\.\s")

_NUMBER_PREFIX_RE = re.compile(r"^\s*\d+\s*\.\s+")
_CANCELED_RE = re.compile(r"^\(?\s*(?:canceled|cancelled|withdrawn|deleted)\b", re.IGNORECASE)
# Referring to another claim makes a claim dependent: "of claim 3", "of clam 4"
# (a typo that occurs in the corpus), and multiple-dependent forms that name no
# number, such as "of any one of the preceding claims".
_CLAIM_REFERENCE_RE = re.compile(
    r"\bcla(?:im|m)s?\s+\d+"
    r"|\b(?:preceding|above|previous|foregoing|aforementioned)\s+claims?\b"
    r"|\bany\s+(?:one\s+)?of\s+(?:the\s+)?claims?\b",
    re.IGNORECASE,
)
# Dependent claims that drop or garble the claim number: "The system as claimed
# 15 , ...", "The ML agent of claim wherein ...".
_DEPENDENT_FORM_RE = re.compile(
    r"^The\b[^,;:.]{0,80}?\b"
    r"(?:as\s+claimed(?:\s+in)?|according\s+to|as\s+recited\s+in|as\s+defined\s+in|of|in)"
    r"\s+(?:\d+\s*,|cla(?:im|m)s?\b)"
)


def extract_independent_claims(claims_text: str | None) -> list[IndependentClaim]:
    """Extract independent claims from a claims blob.

    A claim runs from its numbered line to the next numbered line or canceled
    range. It is independent unless it is canceled or refers to another claim.
    The returned ``claim_text`` excludes the leading number prefix.
    """
    if not claims_text:
        return []

    numbers = {m.start(): int(m.group(1)) for m in CLAIM_START_RE.finditer(claims_text)}
    if not numbers:
        return []
    boundaries = sorted(set(numbers) | {m.start() for m in CLAIM_RANGE_RE.finditer(claims_text)})

    seen_numbers: set[int] = set()
    claims: list[IndependentClaim] = []
    for idx, start in enumerate(boundaries):
        claim_number = numbers.get(start)
        if claim_number is None or claim_number in seen_numbers:
            continue

        end = boundaries[idx + 1] if idx + 1 < len(boundaries) else len(claims_text)
        text = _NUMBER_PREFIX_RE.sub("", claims_text[start:end].strip(), count=1).strip()
        if not text or _CANCELED_RE.match(text):
            continue
        if _CLAIM_REFERENCE_RE.search(text) or _DEPENDENT_FORM_RE.match(text):
            continue

        claims.append(IndependentClaim(claim_number=claim_number, claim_text=text))
        seen_numbers.add(claim_number)

    return claims
