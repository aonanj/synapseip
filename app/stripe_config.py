"""Stripe configuration and client initialization."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

import stripe
from dotenv import load_dotenv

from infrastructure.logger import get_logger

load_dotenv()
logger = get_logger()

@dataclass(frozen=True)
class StripeSettings:
    """Stripe configuration from environment variables.

    Attributes:
        secret_key: Stripe secret key (sk_test_... or sk_live_...)
        webhook_secret: Webhook signing secret (whsec_...)
        price_beta_monthly: Price ID for beta tester monthly plan
        price_beta_90days: Price ID for beta tester 90-day plan
        price_user_monthly: Price ID for user monthly plan
        price_user_yearly: Price ID for user yearly plan
    """

    secret_key: str
    webhook_secret: str
    price_beta_monthly: str
    price_beta_90days: str
    price_user_monthly: str
    price_user_yearly: str

    @property
    def is_test_mode(self) -> bool:
        """Check if running in test mode (using test keys)."""
        return self.secret_key.startswith("sk_test_")


def _require_value(name: str, value: str | None) -> str:
    """Validate that environment variable is set and not empty."""
    if value is None or not value.strip():
        raise RuntimeError(
            f"Environment variable '{name}' is required for Stripe configuration."
        )
    return value.strip()


def _require_prefix(name: str, value: str, prefix: str) -> str:
    """Validate that value starts with expected prefix."""
    if not value.startswith(prefix):
        raise RuntimeError(
            f"Environment variable '{name}' must start with '{prefix}'."
        )
    return value


def _load_stripe_settings() -> StripeSettings:
    """Load and validate Stripe settings from environment."""
    secret_key = _require_value("STRIPE_SECRET_KEY", os.getenv("STRIPE_SECRET_KEY"))

    # Validate secret key format
    if not (secret_key.startswith("sk_test_") or secret_key.startswith("sk_live_")):
        raise RuntimeError(
            "STRIPE_SECRET_KEY must start with 'sk_test_' or 'sk_live_'"
        )

    webhook_secret = _require_prefix(
        "STRIPE_WEBHOOK_SECRET",
        _require_value("STRIPE_WEBHOOK_SECRET", os.getenv("STRIPE_WEBHOOK_SECRET")),
        "whsec_",
    )

    # Price IDs (these can start with 'price_' for real IDs or be placeholders)
    price_beta_monthly = _require_value(
        "STRIPE_PRICE_BETA_MONTHLY", os.getenv("STRIPE_PRICE_BETA_MONTHLY")
    )
    price_beta_90days = _require_value(
        "STRIPE_PRICE_BETA_90DAYS", os.getenv("STRIPE_PRICE_BETA_90DAYS")
    )
    price_user_monthly = _require_value(
        "STRIPE_PRICE_USER_MONTHLY", os.getenv("STRIPE_PRICE_USER_MONTHLY")
    )
    price_user_yearly = _require_value(
        "STRIPE_PRICE_USER_YEARLY", os.getenv("STRIPE_PRICE_USER_YEARLY")
    )

    return StripeSettings(
        secret_key=secret_key,
        webhook_secret=webhook_secret,
        price_beta_monthly=price_beta_monthly,
        price_beta_90days=price_beta_90days,
        price_user_monthly=price_user_monthly,
        price_user_yearly=price_user_yearly,
    )


@lru_cache(maxsize=1)
def get_stripe_settings() -> StripeSettings:
    """Get cached Stripe settings. Initialize on first call."""
    settings = _load_stripe_settings()

    # Configure the global Stripe API key
    stripe.api_key = settings.secret_key

    return settings


def reset_stripe_settings_cache() -> None:
    """Clear cached Stripe settings. Useful for testing."""
    get_stripe_settings.cache_clear()


def ensure_stripe_configured() -> None:
    """Ensure Stripe is configured. Call at app startup."""
    settings = get_stripe_settings()
    mode = "test" if settings.is_test_mode else "live"
    logger.info(f"✓ Stripe configured in {mode} mode")
