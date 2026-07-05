#!/usr/bin/env python3
"""
Update price_plan table with actual Stripe Price IDs.

This script helps you update the placeholder price IDs in the database
after creating products in the Stripe Dashboard.

Usage:
    python update_stripe_prices.py

The script will prompt you to enter each Price ID interactively.
"""

from __future__ import annotations

import os
import sys

import psycopg
from dotenv import load_dotenv


def get_price_id(tier_name: str, current_placeholder: str) -> str:
    """Prompt user for a Stripe Price ID."""
    print(f"\n{'=' * 60}")
    print(f"Tier: {tier_name}")
    print(f"Current placeholder: {current_placeholder}")
    print("=" * 60)

    while True:
        price_id = input("Enter Stripe Price ID (starts with 'price_'): ").strip()

        if not price_id:
            print("⚠︎ Price ID cannot be empty. Please try again.")
            continue

        if not price_id.startswith("price_"):
            print("‼︎  Warning: Price ID should start with 'price_'")
            confirm = input("Continue anyway? (y/n): ").strip().lower()
            if confirm != "y":
                continue

        return price_id


def main() -> None:
    """Update price_plan table with real Stripe Price IDs."""
    print("\n" + "=" * 60)
    print("Stripe Price ID Update Utility")
    print("=" * 60)

    # Load environment variables
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("⚠︎ ERROR: DATABASE_URL not found in environment variables")
        print("Make sure you have a .env file with DATABASE_URL set")
        sys.exit(1)

    print(f"\n✓ Database URL loaded: {database_url[:30]}...")

    # Price tiers to update
    price_updates = [
        {
            "placeholder": "prod_THLOpWmscBz30w",
            "name": "Beta Tester - Monthly ($99/month)",
            "tier": "beta_tester",
        },
        {
            "placeholder": "prod_THLPA42b6aQ7ec",
            "name": "Beta Tester - 90 Days ($259 for 3 months)",
            "tier": "beta_tester",
        },
        {
            "placeholder": "prod_THLQlinZFs5Uhy",
            "name": "User - Monthly ($189/month)",
            "tier": "user",
        },
        {
            "placeholder": "prod_THLR3OHRS4rtMA",
            "name": "User - Yearly ($1,899/year)",
            "tier": "user",
        },
    ]

    print("\nYou will be prompted to enter the Stripe Price ID for each tier.")
    print("You can find these in your Stripe Dashboard under Products.\n")

    input("Press Enter to continue...")

    updates = []
    for price_info in price_updates:
        new_price_id = get_price_id(price_info["name"], price_info["placeholder"])
        updates.append((new_price_id, price_info["placeholder"]))

    # Confirm updates
    print("\n" + "=" * 60)
    print("Confirm Updates")
    print("=" * 60)
    for new_id, placeholder in updates:
        print(f"{placeholder:<40} → {new_id}")

    confirm = input("\nProceed with these updates? (yes/no): ").strip().lower()
    if confirm not in ("yes", "y"):
        print("⚠︎ Update cancelled")
        sys.exit(0)

    # Connect to database and update
    print("\n⇌ Connecting to database...")

    try:
        with psycopg.connect(database_url) as conn, conn.cursor() as cur:
            print("✓ Connected successfully\n")

            for new_price_id, placeholder in updates:
                print(f"Updating {placeholder}...")

                cur.execute(
                    "UPDATE price_plan SET stripe_price_id = %s, updated_at = NOW() "
                    "WHERE stripe_price_id = %s",
                    [new_price_id, placeholder],
                )

                if cur.rowcount == 1:
                    print(f"  ✓ Updated to {new_price_id}")
                else:
                    print(f"  ⚠️  Warning: {cur.rowcount} rows affected (expected 1)")

            conn.commit()

            # Verify updates
            print("\n" + "=" * 60)
            print("Verification - Current price_plan table:")
            print("=" * 60)

            cur.execute(
                "SELECT tier, name, amount_cents, currency, stripe_price_id, is_active "
                "FROM price_plan ORDER BY tier, amount_cents"
            )

            rows = cur.fetchall()
            for row in rows:
                tier, name, amount_cents, currency, price_id, is_active = row
                status = "✓ Active" if is_active else "✗ Inactive"
                amount = amount_cents / 100.0
                print(
                    f"\n{tier.upper()}: {name}"
                    f"\n  Price ID: {price_id}"
                    f"\n  Amount: ${amount:.2f} {currency.upper()}"
                    f"\n  Status: {status}"
                )

        print("\n" + "=" * 60)
        print("✓ All price IDs updated successfully!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Add these Price IDs to your .env file for reference")
        print("2. Configure Stripe webhooks (see STRIPE_SETUP.md)")
        print("3. Test subscription creation flow")

    except psycopg.Error as e:
        print(f"\n⚠︎ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n⚠︎ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
