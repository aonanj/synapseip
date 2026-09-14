from __future__ import annotations

from itertools import pairwise

import pytest

from app import scope_scoring


def test_calibrated_score_anchors_on_identical_and_background() -> None:
    assert scope_scoring.calibrated_score(0.0) == pytest.approx(1.0)
    assert scope_scoring.calibrated_score(scope_scoring.BACKGROUND_DISTANCE) == pytest.approx(0.0)


def test_calibrated_score_clamps_beyond_background() -> None:
    beyond = scope_scoring.BACKGROUND_DISTANCE * 1.5
    assert scope_scoring.calibrated_score(beyond) == 0.0


def test_calibrated_score_is_non_increasing_in_distance() -> None:
    distances = [i / 100 for i in range(0, 101)]
    scores = [scope_scoring.calibrated_score(d) for d in distances]
    assert all(a >= b for a, b in pairwise(scores))
    # Strictly decreasing below the background anchor, so ranking is preserved.
    below = [d for d in distances if d < scope_scoring.BACKGROUND_DISTANCE]
    below_scores = [scope_scoring.calibrated_score(d) for d in below]
    assert all(a > b for a, b in pairwise(below_scores))


def test_risk_band_boundaries() -> None:
    assert scope_scoring.risk_band(scope_scoring.HIGH_BAND) == "high"
    assert scope_scoring.risk_band(scope_scoring.HIGH_BAND - 0.01) == "moderate"
    assert scope_scoring.risk_band(scope_scoring.MODERATE_BAND) == "moderate"
    assert scope_scoring.risk_band(scope_scoring.MODERATE_BAND - 0.01) == "low"
