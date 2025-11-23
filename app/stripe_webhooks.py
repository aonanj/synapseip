"""Stripe webhook event handlers.

This module processes Stripe webhook events to keep subscription data in sync.
All handlers are idempotent - processing the same event multiple times is safe.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, cast
from uuid import UUID

import stripe
from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, Request
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Json

from app.stripe_config import get_stripe_settings
from infrastructure.logger import get_logger

logger = get_logger()


class WebhookError(Exception):
    """Base exception for webhook processing errors."""

    pass


def _json_default(value: Any) -> Any:
    """JSON serializer for values not handled by default encoder."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat()
    if isinstance(value, (Decimal, timedelta)):
        return str(value)
    return str(value)


def _to_utc_datetime(timestamp: Any) -> datetime | None:
    """Convert a Stripe timestamp (seconds since epoch) to aware UTC datetime."""
    if timestamp in (None, ""):
        return None
    if isinstance(timestamp, datetime):
        return timestamp.astimezone(UTC)
    try:
        return datetime.fromtimestamp(float(timestamp), tz=UTC)
    except (TypeError, ValueError, OSError):
        return None


def _compute_period_end(
    start: datetime | None,
    end: datetime | None,
    interval: str | None,
    interval_count: int | None,
) -> tuple[datetime | None, bool]:
    """Ensure period end is after period start, computing a fallback when needed."""
    if start is None:
        return None, False

    if end and end > start:
        return end, False

    interval_count = interval_count or 1
    computed_end = start

    if interval == "day":
        computed_end = start + timedelta(days=interval_count)
    elif interval == "week":
        computed_end = start + timedelta(weeks=interval_count)
    elif interval == "month":
        computed_end = start + relativedelta(months=interval_count)
    elif interval == "year":
        computed_end = start + relativedelta(years=interval_count)

    return computed_end, True


def _to_uuid(value: Any) -> UUID | None:
    """Convert a value to a UUID if possible."""
    if not value:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        logger.warning("Unable to coerce value %s to UUID", value)
        return None


async def _lookup_subscription_db_id(
    conn: AsyncConnection, stripe_subscription_id: str | None
) -> str | None:
    """Fetch local subscription ID that matches a Stripe subscription ID."""
    if not stripe_subscription_id:
        return None

    async with conn.cursor() as cur:
        await cur.execute(
            "SELECT id FROM subscription WHERE stripe_subscription_id = %s",
            [stripe_subscription_id],
        )
        row = await cur.fetchone()

    if not row:
        return None

    return str(row[0])


def _normalize_event_object(event_object: Any) -> dict[str, Any]:
    """Convert Stripe event payload into a JSON-serializable dictionary."""
    if isinstance(event_object, dict):
        return event_object

    to_dict = getattr(event_object, "to_dict_recursive", None)
    if callable(to_dict):
        return cast(dict[str, Any], to_dict())

    try:
        return json.loads(json.dumps(event_object, default=_json_default))
    except (TypeError, ValueError):
        logger.warning("Failed to normalize Stripe event object; storing string fallback")
        return {"raw": str(event_object)}


def _extract_stripe_subscription_id(
    event_type: str, event_object: dict[str, Any] | Any
) -> str | None:
    """Pull the Stripe subscription ID from a webhook payload when available."""
    try:
        getter = event_object.get  # type: ignore[attr-defined]
    except AttributeError:
        return None

    if event_type.startswith("customer.subscription."):
        return getter("id")

    if event_type.startswith("invoice."):
        # Try top-level subscription field (legacy API structure)
        subscription_id = getter("subscription")
        if subscription_id:
            return subscription_id

        # Try nested parent.subscription_details.subscription (new API structure)
        parent = getter("parent") or {}
        if isinstance(parent, dict):
            subscription_details = parent.get("subscription_details") or {}
            if isinstance(subscription_details, dict):
                subscription_id = subscription_details.get("subscription")
                if subscription_id:
                    return subscription_id

        # Try line items (both legacy and new API structures)
        lines = getter("lines") or {}
        line_get = getattr(lines, "get", None)
        if callable(line_get):
            data = line_get("data") or []
        else:
            data = lines.get("data", []) if isinstance(lines, dict) else []

        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    # Legacy: subscription or subscription_id at line item level
                    candidate = item.get("subscription")
                    if candidate:
                        return candidate
                    candidate = item.get("subscription_id")
                    if candidate:
                        return candidate

                    # New API: parent.subscription_item_details.subscription
                    item_parent = item.get("parent") or {}
                    if isinstance(item_parent, dict):
                        sub_item_details = item_parent.get("subscription_item_details") or {}
                        if isinstance(sub_item_details, dict):
                            candidate = sub_item_details.get("subscription")
                            if candidate:
                                return candidate

        return None

    if event_type == "checkout.session.completed":
        return getter("subscription")

    return None


async def _resolve_subscription_id(
    conn: AsyncConnection,
    event_type: str,
    event_object: Any,
    subscription_id: str | None,
) -> str | None:
    """Prefer handler-provided subscription_id, otherwise look it up from payload."""
    if subscription_id:
        return subscription_id

    stripe_subscription_id = _extract_stripe_subscription_id(event_type, event_object)
    if not stripe_subscription_id:
        return None

    return await _lookup_subscription_db_id(conn, stripe_subscription_id)


async def _backfill_subscription_events(
    conn: AsyncConnection, subscription_uuid: str | None, stripe_subscription_id: str | None
) -> None:
    """Attach subscription UUID to any prior events missing the linkage."""
    if not subscription_uuid or not stripe_subscription_id:
        return

    async with conn.cursor() as cur:
        await cur.execute(
            """
            UPDATE subscription_event
               SET subscription_id = %s
             WHERE subscription_id IS NULL
               AND (
                   event_data ->> 'subscription' = %s
                OR event_data ->> 'id' = %s
                OR event_data #>> '{parent,subscription_details,subscription}' = %s
               )
            """,
            [
                _to_uuid(subscription_uuid),
                stripe_subscription_id,
                stripe_subscription_id,
                stripe_subscription_id,
            ],
        )


async def verify_webhook_signature(request: Request) -> stripe.Event:
    """Verify Stripe webhook signature and parse event.

    Args:
        request: FastAPI request object containing webhook payload

    Returns:
        Parsed Stripe event object

    Raises:
        HTTPException: If signature verification fails
    """
    settings = get_stripe_settings()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        logger.error("Missing Stripe signature header")
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.webhook_secret
        )
        logger.info(f"Verified webhook event: {event['type']} (id: {event['id']})")
        return event
    except ValueError as e:
        logger.error(f"Invalid webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload") from e
    except stripe.SignatureVerificationError as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature") from e


async def is_event_processed(conn: AsyncConnection, event_id: str) -> bool:
    """Check if webhook event has already been processed.

    Args:
        conn: Database connection
        event_id: Stripe event ID

    Returns:
        True if event already exists in subscription_event table
    """
    async with conn.cursor() as cur:
        await cur.execute(
            "SELECT 1 FROM subscription_event WHERE stripe_event_id = %s",
            [event_id],
        )
        result = await cur.fetchone()
        return result is not None


async def log_event(
    conn: AsyncConnection,
    event_id: str,
    event_type: str,
    event_data: Any,
    subscription_id: str | None = None,
) -> None:
    """Log webhook event to subscription_event table.

    Args:
        conn: Database connection
        event_id: Stripe event ID
        event_type: Event type (e.g., 'customer.subscription.updated')
        event_data: Full event data object (dict or Stripe payload)
        subscription_id: UUID of related subscription record (if any)
    """
    # Ensure stable JSON payload for querying
    if hasattr(event_data, "to_dict_recursive"):
        event_json = event_data.to_dict_recursive()
    else:
        event_json = event_data

    try:
        safe_event_json = json.loads(json.dumps(event_json, default=_json_default))
    except (TypeError, ValueError):
        safe_event_json = {"raw": str(event_json)}

    async with conn.cursor() as cur:
        await cur.execute(
            "INSERT INTO subscription_event (stripe_event_id, subscription_id, event_type, event_data) "
            "VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (stripe_event_id) DO UPDATE "
            "SET subscription_id = COALESCE(subscription_event.subscription_id, EXCLUDED.subscription_id), "
            "    event_data = EXCLUDED.event_data",
            [
                event_id,
                _to_uuid(subscription_id),
                event_type,
                Json(safe_event_json),
            ],
        )


async def get_or_create_stripe_customer(
    conn: AsyncConnection, user_id: str, email: str, stripe_customer_id: str
) -> None:
    """Create or update stripe_customer record.

    Args:
        conn: Database connection
        user_id: Auth0 user ID
        email: Customer email
        stripe_customer_id: Stripe customer ID
    """
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO stripe_customer (user_id, stripe_customer_id, email)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE
            SET stripe_customer_id = EXCLUDED.stripe_customer_id,
                email = EXCLUDED.email,
                updated_at = NOW()
            """,
            [user_id, stripe_customer_id, email],
        )


async def upsert_subscription(
    conn: AsyncConnection, subscription_data: dict[str, Any]
) -> str | None:
    """Create or update subscription record from Stripe subscription object.

    Args:
        conn: Database connection
        subscription_data: Stripe subscription object

    Returns:
        UUID of the subscription record, or None if failed
    """
    stripe_subscription_id = subscription_data["id"]
    stripe_customer_id = subscription_data["customer"]
    status = subscription_data["status"]

    current_period_start = (
        _to_utc_datetime(subscription_data.get("current_period_start"))
        or _to_utc_datetime(subscription_data.get("created"))
        or datetime.now(UTC)
    )
    current_period_end = _to_utc_datetime(subscription_data.get("current_period_end"))
    cancel_at_period_end = bool(subscription_data.get("cancel_at_period_end", False))

    # Get the price ID from the subscription items
    items = subscription_data.get("items", {}).get("data", [])
    if not items:
        logger.error(f"No items found in subscription {stripe_subscription_id}")
        return None

    stripe_price_id = items[0]["price"]["id"]

    # Handle canceled_at timestamp
    canceled_at = _to_utc_datetime(subscription_data.get("canceled_at"))

    # Get user_id from stripe_customer table
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            "SELECT user_id FROM stripe_customer WHERE stripe_customer_id = %s",
            [stripe_customer_id],
        )
        customer = await cur.fetchone()

        if not customer:
            logger.error(
                f"No user found for Stripe customer {stripe_customer_id}. "
                "This should have been created during checkout."
            )
            return None

        user_id = customer["user_id"]

        # Get plan details from price_plan table
        await cur.execute(
            "SELECT tier, interval, interval_count FROM price_plan WHERE stripe_price_id = %s",
            [stripe_price_id],
        )
        plan = await cur.fetchone()

        if not plan:
            logger.error(f"Unknown price ID: {stripe_price_id}")
            return None

        tier = plan["tier"]
        plan_interval = plan.get("interval")
        plan_interval_count = plan.get("interval_count", 1)

        current_period_end, recomputed_period = _compute_period_end(
            current_period_start, current_period_end, plan_interval, plan_interval_count
        )

        if recomputed_period:
            logger.warning(
                "Derived current_period_end=%s for subscription %s using interval %s x%s",
                current_period_end,
                stripe_subscription_id,
                plan_interval,
                plan_interval_count,
            )

        # Check if subscription exists
        await cur.execute(
            "SELECT id, tier, tier_started_at, current_period_end FROM subscription WHERE stripe_subscription_id = %s",
            [stripe_subscription_id],
        )
        existing = await cur.fetchone()

        if existing:
            # Update existing subscription

            # Check for stale data (e.g. race condition between invoice.payment_succeeded and customer.subscription.updated)
            existing_period_end = existing["current_period_end"]
            if existing_period_end and existing_period_end.tzinfo is None:
                existing_period_end = existing_period_end.replace(tzinfo=UTC)

            if existing_period_end and current_period_end and current_period_end < existing_period_end:
                logger.info(
                    f"Skipping stale subscription update for {stripe_subscription_id}. "
                    f"Incoming end: {current_period_end}, Existing end: {existing_period_end}"
                )
                return str(existing["id"])

            # Preserve tier_started_at if tier hasn't changed
            tier_started_at = existing["tier_started_at"]
            if tier_started_at and tier_started_at.tzinfo is None:
                tier_started_at = tier_started_at.replace(tzinfo=UTC)

            if existing.get("tier") != tier or not tier_started_at:
                tier_started_at = datetime.now(UTC)

            await cur.execute(
                """
                UPDATE subscription
                SET status = %s,
                    stripe_price_id = %s,
                    tier = %s,
                    current_period_start = %s,
                    current_period_end = %s,
                    cancel_at_period_end = %s,
                    canceled_at = %s,
                    tier_started_at = %s,
                    updated_at = NOW()
                WHERE stripe_subscription_id = %s
                RETURNING id
                """,
                [
                    status,
                    stripe_price_id,
                    tier,
                    current_period_start,
                    current_period_end,
                    cancel_at_period_end,
                    canceled_at,
                    tier_started_at,
                    stripe_subscription_id,
                ],
            )
            result = await cur.fetchone()
            if result:
                subscription_uuid = str(result["id"])
                await _backfill_subscription_events(
                    conn, subscription_uuid, stripe_subscription_id
                )
                logger.info(f"Updated subscription {stripe_subscription_id}")
                return subscription_uuid
            logger.info(f"Updated subscription {stripe_subscription_id}")
            return None
        else:
            # Create new subscription
            await cur.execute(
                """
                INSERT INTO subscription (
                    user_id,
                    stripe_subscription_id,
                    stripe_customer_id,
                    stripe_price_id,
                    tier,
                    status,
                    current_period_start,
                    current_period_end,
                    cancel_at_period_end,
                    canceled_at,
                    tier_started_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
                """,
                [
                    user_id,
                    stripe_subscription_id,
                    stripe_customer_id,
                    stripe_price_id,
                    tier,
                    status,
                    current_period_start,
                    current_period_end,
                    cancel_at_period_end,
                    canceled_at,
                ],
            )
            result = await cur.fetchone()
            if result:
                subscription_uuid = str(result["id"])
                await _backfill_subscription_events(
                    conn, subscription_uuid, stripe_subscription_id
                )
                logger.info(f"Created new subscription {stripe_subscription_id}")
                return subscription_uuid
            logger.info(f"Created new subscription {stripe_subscription_id}")
            return None


# ============================================================================
# Event Handlers
# ============================================================================


async def handle_checkout_session_completed(
    conn: AsyncConnection, event: stripe.Event
) -> str | None:
    """Handle successful checkout session completion.

    Event fires when customer completes the Stripe Checkout.
    Creates the stripe_customer record linking Auth0 user to Stripe.

    Args:
        conn: Database connection
        event: Stripe event object

    Returns:
        Subscription ID if created, None otherwise
    """
    session = event["data"]["object"]

    # Get metadata from checkout session (set when creating checkout session)
    metadata = session.get("metadata", {})
    user_id = metadata.get("user_id")  # Auth0 user ID

    if not user_id:
        logger.error(
            f"Checkout session {session['id']} missing user_id in metadata. "
            "Ensure metadata.user_id is set when creating checkout sessions."
        )
        return None

    stripe_customer_id = session["customer"]
    email = session.get("customer_email") or session.get("customer_details", {}).get(
        "email"
    )

    if not email:
        logger.error(f"No email found for checkout session {session['id']}")
        email = f"unknown@{stripe_customer_id}"

    # Create stripe_customer record
    await get_or_create_stripe_customer(conn, user_id, email, stripe_customer_id)
    logger.info(
        f"Created/updated stripe_customer for user {user_id} -> {stripe_customer_id}"
    )

    # If there's a subscription, it will be handled by subscription.created event
    subscription_id = session.get("subscription")
    if subscription_id:
        logger.info(
            f"Checkout session has subscription {subscription_id}, "
            "will be processed by subscription.created event"
        )
        existing_subscription_id = await _lookup_subscription_db_id(
            conn, subscription_id
        )
        if existing_subscription_id:
            return existing_subscription_id

    return None


async def handle_subscription_created(
    conn: AsyncConnection, event: stripe.Event
) -> str | None:
    """Handle new subscription creation.

    Args:
        conn: Database connection
        event: Stripe event object

    Returns:
        Subscription ID if created
    """
    subscription = event["data"]["object"]

    # If subscription is missing period dates, fetch from Stripe
    # This happens when subscription is created via Checkout in incomplete state
    if not subscription.get("current_period_start") or not subscription.get("current_period_end"):
        logger.info(
            f"Subscription {subscription['id']} missing period dates, "
            "fetching from Stripe API"
        )
        try:
            subscription = stripe.Subscription.retrieve(subscription["id"])
            logger.info("Fetched complete subscription data from Stripe")
        except Exception as e:
            logger.error(f"Failed to fetch subscription from Stripe: {e}")
            # Continue with event data anyway

    return await upsert_subscription(conn, subscription)


async def handle_subscription_updated(
    conn: AsyncConnection, event: stripe.Event
) -> str | None:
    """Handle subscription updates (status changes, plan changes, etc).

    Args:
        conn: Database connection
        event: Stripe event object

    Returns:
        Subscription ID if updated
    """
    subscription = event["data"]["object"]

    # If subscription is missing period dates, fetch from Stripe
    if not subscription.get("current_period_start") or not subscription.get("current_period_end"):
        logger.info(
            f"Subscription {subscription['id']} missing period dates, "
            "fetching from Stripe API"
        )
        try:
            subscription = stripe.Subscription.retrieve(subscription["id"])
            logger.info("Fetched complete subscription data from Stripe")
        except Exception as e:
            logger.error(f"Failed to fetch subscription from Stripe: {e}")
            # Continue with event data anyway

    return await upsert_subscription(conn, subscription)


async def handle_subscription_deleted(
    conn: AsyncConnection, event: stripe.Event
) -> str | None:
    """Handle subscription deletion/cancellation.

    Args:
        conn: Database connection
        event: Stripe event object

    Returns:
        Subscription ID if updated
    """
    subscription = event["data"]["object"]
    subscription["status"] = "canceled"  # Ensure status is canceled
    return await upsert_subscription(conn, subscription)


async def handle_invoice_payment_succeeded(
    conn: AsyncConnection, event: stripe.Event
) -> str | None:
    """Handle successful invoice payment.

    This ensures subscription is marked active after successful payment.

    Args:
        conn: Database connection
        event: Stripe event object

    Returns:
        Subscription ID if updated
    """
    invoice = event["data"]["object"]
    subscription_id = invoice.get("subscription")

    if not subscription_id:
        logger.info("Invoice payment succeeded but no subscription attached")
        return None

    # Fetch the latest subscription data from Stripe
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        return await upsert_subscription(conn, subscription)
    except stripe.StripeError as e:
        logger.error(f"Failed to retrieve subscription {subscription_id}: {e}")
        return None


async def handle_invoice_payment_failed(
    conn: AsyncConnection, event: stripe.Event
) -> str | None:
    """Handle failed invoice payment.

    Updates subscription status to past_due or unpaid.

    Args:
        conn: Database connection
        event: Stripe event object

    Returns:
        Subscription ID if updated
    """
    invoice = event["data"]["object"]
    subscription_id = invoice.get("subscription")

    if not subscription_id:
        logger.info("Invoice payment failed but no subscription attached")
        return None

    # Fetch the latest subscription data from Stripe
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        return await upsert_subscription(conn, subscription)
    except stripe.StripeError as e:
        logger.error(f"Failed to retrieve subscription {subscription_id}: {e}")
        return None


# ============================================================================
# Main Event Router
# ============================================================================

# Map event types to handler functions
EVENT_HANDLERS = {
    "checkout.session.completed": handle_checkout_session_completed,
    "customer.subscription.created": handle_subscription_created,
    "customer.subscription.updated": handle_subscription_updated,
    "customer.subscription.deleted": handle_subscription_deleted,
    "invoice.payment_succeeded": handle_invoice_payment_succeeded,
    "invoice.payment_failed": handle_invoice_payment_failed,
}


async def process_webhook_event(conn: AsyncConnection, event: stripe.Event) -> None:
    """Process a Stripe webhook event.

    This is the main entry point for webhook processing. It ensures idempotency,
    routes events to appropriate handlers, and logs all events.

    Args:
        conn: Database connection
        event: Verified Stripe event object

    Raises:
        WebhookError: If event processing fails
    """
    event_id = event["id"]
    event_type = event["type"]

    # Check if event already processed (idempotency)
    if await is_event_processed(conn, event_id):
        logger.info(f"Event {event_id} already processed, skipping")
        return

    # Route to appropriate handler
    handler = EVENT_HANDLERS.get(event_type)

    event_object_raw = event["data"]["object"]
    event_object = _normalize_event_object(event_object_raw)

    if handler:
        logger.info(f"Processing event {event_type} (id: {event_id})")
        subscription_id: str | None = None
        try:
            subscription_id = await handler(conn, event)
            subscription_id = await _resolve_subscription_id(
                conn, event_type, event_object, subscription_id
            )

            # Log event to subscription_event table
            await log_event(
                conn, event_id, event_type, event_object, subscription_id
            )

            logger.info(f"Successfully processed event {event_id}")
        except Exception as e:
            logger.error(f"Error processing event {event_id}: {e}", exc_info=True)
            # Still log the event even if processing failed
            resolved_subscription_id = await _resolve_subscription_id(
                conn, event_type, event_object, subscription_id
            )
            await log_event(
                conn,
                event_id,
                event_type,
                event_object,
                resolved_subscription_id,
            )
            raise WebhookError(f"Failed to process event {event_type}") from e
    else:
        # Log unhandled events for monitoring
        logger.info(f"Unhandled event type: {event_type} (id: {event_id})")
        resolved_subscription_id = await _resolve_subscription_id(
            conn, event_type, event_object, None
        )
        await log_event(
            conn, event_id, event_type, event_object, resolved_subscription_id
        )
