"""Calibrated scoring for Scope Analysis claim matches.

Raw cosine similarity (``1 - distance``) is not meaningful to a user on this
corpus. Every claim in ``patent_claim`` is an AI/ML patent claim, so any two
claims share both legal boilerplate ("A method comprising:", "one or more
processors", "a non-transitory computer-readable medium storing instructions
that, when executed, cause...") and domain vocabulary. Two *randomly chosen*
claims therefore already sit at a raw similarity around 0.40, and the nearest
claim to an arbitrary query sits around 0.73 -- so raw similarity reads high
even when nothing relevant was found.

This module rescales cosine distance against that measured background:

    score = clamp01(1 - distance / BACKGROUND_DISTANCE)

which reads as: **100% = identical claim language, 0% = no closer than a
randomly chosen claim from the corpus.**

The mapping is non-increasing in ``distance``, so it never reorders results.
Because it clamps at 0, callers must keep sorting on raw ``distance`` rather
than on the score -- see ``ScopeClaimMatch.distance``.
"""

from __future__ import annotations

import os
from typing import Final, Literal

RiskBand = Literal["high", "moderate", "low"]

# Median cosine distance between two claims drawn at random from different
# patents. Measured 2026-09-13 over 999,789 cross-patent pairs sampled from
# 5,000 random patent_claim_embeddings rows (text-embedding-3-small, 1536-dim):
#
#   p1 0.4143 | p10 0.5030 | p25 0.5515 | p50 0.6039 | p75 0.6553 | p90 0.7003
#   mean 0.6024, sd 0.0773
#
# For contrast, two different independent claims of the *same* patent sit at a
# median distance of 0.074, and re-embedding a claim's own stored text lands
# within 0.001 of its stored vector.
#
# Re-measure and update this if the embedding model or the corpus mix changes.
BACKGROUND_DISTANCE: Final[float] = float(
    os.environ.get("SCOPE_BACKGROUND_DISTANCE", "0.604")
)

# Cutoffs on the calibrated scale, chosen from the measured distribution of
# real top-1 results (120 sampled queries against the live corpus):
#
#   distance p10 = 0.0623 -> score 0.897     distance p50 = 0.2666 -> score 0.559
#   distance p25 = 0.2113 -> score 0.650     distance p90 = 0.3349 -> score 0.445
#
# There is a natural gap between p10 and p25: a query either has a
# near-duplicate in the corpus (continuations, same family) or it does not.
# HIGH sits above that gap; MODERATE sits at the p25 break.
#
# The previous raw-similarity cutoffs (0.75 / 0.55) fired "Moderate or worse"
# on 99.2% of queries and "High" on 41.7%, which is why the bands carried no
# information.
#
# Re-checked 2026-09-13 after the claim backfill grew the corpus from 72k to
# 189k claims (now ~52% published applications): background p50 0.6081
# (+0.004); top-1 p10 0.0814 / p25 0.1840 / p50 0.2551 / p90 0.3490 over 120
# queries; bands fired high 10.8%, moderate 20.0%, low 69.2%. Constants kept:
# the background shift is well under 0.01, and more moderate matches reflect a
# denser corpus rather than a miscalibrated scale.
HIGH_BAND: Final[float] = 0.85
MODERATE_BAND: Final[float] = 0.65


def calibrated_score(distance: float) -> float:
    """Rescale a cosine distance to [0, 1] against the corpus background.

    Returns 1.0 for identical claim language and 0.0 for anything no closer
    than a randomly chosen claim. Non-increasing in ``distance``.
    """
    if BACKGROUND_DISTANCE <= 0:
        return 0.0
    return max(0.0, min(1.0, 1.0 - distance / BACKGROUND_DISTANCE))


def risk_band(score: float) -> RiskBand:
    """Band a calibrated score. Single source of truth for the UI and the PDF."""
    if score >= HIGH_BAND:
        return "high"
    if score >= MODERATE_BAND:
        return "moderate"
    return "low"
