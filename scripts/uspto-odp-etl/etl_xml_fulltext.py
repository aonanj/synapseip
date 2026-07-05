#!/usr/bin/env python3
"""
etl_xml_fulltext.py

USPTO Patent Application Full Text XML → Postgres loader for SynapseIP.

Parses USPTO bulk XML files (e.g., ipa250220.xml) containing full text of patent
applications and upserts abstracts and claims into the patent_staging table.

Each XML file contains multiple <us-patent-application> records. This script:
1. Constructs pub_id from country-doc_number-kind
2. Extracts plain text from <abstract> tag
3. Extracts plain text from <claim-text> tags (excluding <us-claim-statement>)
4. Upserts abstract and claims_text to existing patent_staging records
"""

from __future__ import annotations

import argparse
import contextlib
import os
import sys
import re
import time
import xml.etree.ElementTree as ET
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg
from dotenv import load_dotenv
from psycopg import Connection
from psycopg.rows import TupleRow

from infrastructure.logger import setup_logger

logger = setup_logger()

# -----------------------
# Configuration constants
# -----------------------
load_dotenv()

# psycopg generics
type PgConn = Connection[TupleRow]

# -------------
# SQL templates
# -------------

UPDATE_STAGING_SQL = """
UPDATE patent_staging
SET
    abstract = COALESCE(%(abstract)s, abstract),
    claims_text = COALESCE(%(claims_text)s, claims_text),
    updated_at = NOW()
WHERE pub_id = %(pub_id)s
RETURNING pub_id;
"""

UPDATE_STAGING_WITH_KIND_SQL = """
UPDATE patent_staging
SET
    pub_id = %(pub_id)s || '-' || %(kind_code)s,
    abstract = COALESCE(%(abstract)s, abstract),
    claims_text = COALESCE(%(claims_text)s, claims_text),
    kind_code = %(kind_code)s,
    updated_at = NOW()
WHERE pub_id = %(pub_id)s
RETURNING pub_id;
"""

UPDATE_STAGING_BY_APPLICATION_SQL = """
UPDATE patent_staging
SET
    pub_id = %(pub_id)s,
    abstract = COALESCE(%(abstract)s, abstract),
    claims_text = COALESCE(%(claims_text)s, claims_text),
    kind_code = COALESCE(%(kind_code)s, kind_code),
    updated_at = NOW()
WHERE application_number IS NOT NULL
  AND BTRIM(
        CASE
            WHEN application_number ILIKE 'US%%' THEN SUBSTRING(application_number FROM 3)
            ELSE application_number
        END
    ) = %(application_doc_number)s
RETURNING pub_id;
"""

CHECK_RECORD_EXISTS_SQL = """
SELECT pub_id FROM patent_staging WHERE pub_id = %(pub_id)s;
"""

UPSERT_CLAIM_STAGING_SQL = """
INSERT INTO patent_claim_staging (
    pub_id,
    claim_number,
    is_independent,
    claim_text
) VALUES (
    %(pub_id)s,
    %(claim_number)s,
    %(is_independent)s,
    %(claim_text)s
)
ON CONFLICT (pub_id, claim_number) DO UPDATE
SET
    claim_text = EXCLUDED.claim_text,
    is_independent = EXCLUDED.is_independent,
    updated_at = NOW();
"""


# -----------------------
# Connection Management
# -----------------------

def create_connection(dsn: str, max_retries: int = 3, retry_delay: float = 1.0) -> PgConn:
    """Create a new database connection with retry logic.

    Args:
        dsn: PostgreSQL DSN string.
        max_retries: Maximum number of connection attempts.
        retry_delay: Delay between retries in seconds.

    Returns:
        Database connection.

    Raises:
        psycopg.OperationalError: If connection fails after all retries.
    """
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            conn = psycopg.connect(
                dsn,
                autocommit=False,
                sslmode="require",
            )
            logger.info("Database connection established")
            return conn
        except psycopg.OperationalError as e:
            last_error = e
            if attempt < max_retries - 1:
                logger.error(f"Connection attempt {attempt + 1} failed: {e}. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to connect after {max_retries} attempts")
                raise
    
    # This should never be reached due to raise above, but satisfies type checker
    raise psycopg.OperationalError(f"Failed to connect after {max_retries} attempts") from last_error


def is_connection_alive(conn: PgConn) -> bool:
    """Check if database connection is still alive.

    Args:
        conn: Database connection to check.

    Returns:
        True if connection is alive, False otherwise.
    """
    try:
        # Try to get the connection status
        if conn.closed:
            return False
        # Execute a simple query to verify connection
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return True
    except (psycopg.OperationalError, psycopg.InterfaceError):
        return False


def safe_rollback(conn: PgConn) -> None:
    """Safely rollback a connection, handling connection loss.

    Args:
        conn: Database connection to rollback.
    """
    try:
        if not conn.closed:
            conn.rollback()
            logger.info("Transaction rolled back")
    except (psycopg.OperationalError, psycopg.InterfaceError) as e:
        logger.error(f"Rollback failed (connection likely lost): {e}")


# --------------
# Data structures
# --------------

@dataclass
class PatentClaim:
    """Structured representation of a single patent claim."""

    claim_number: int
    claim_text: str
    is_independent: bool = True


@dataclass
class PatentFullText:
    """Patent full text extracted from USPTO XML."""

    pub_id: str
    abstract: str | None
    claims_text: str | None
    kind: str | None = None
    doc_number: str | None = None
    application_number: str | None = None
    independent_claims: list[PatentClaim] = field(default_factory=list)


TARGET_INDEPENDENT_KINDS = {"B1", "B2"}


def _compose_pub_id(pub_id: str, kind: str | None) -> str:
    """Return canonical pub_id including kind code when present."""
    if kind:
        suffix = kind.strip()
        if pub_id.endswith(f"-{suffix}"):
            return pub_id
        return f"{pub_id}-{suffix}"
    return pub_id


def insert_independent_claims(
    conn: PgConn,
    pub_id: str,
    claims: Sequence[PatentClaim],
) -> int:
    """Insert or update independent claims for a pub_id in staging."""
    if not claims:
        return 0

    staged = 0
    with conn.cursor() as cur:
        for claim in claims:
            if not claim.claim_text:
                continue
            cur.execute(
                UPSERT_CLAIM_STAGING_SQL,
                {
                    "pub_id": pub_id,
                    "claim_number": claim.claim_number,
                    "is_independent": claim.is_independent,
                    "claim_text": claim.claim_text,
                },
            )
            staged += 1
    return staged


def maybe_stage_independent_claims(conn: PgConn, record: PatentFullText) -> int:
    """Stage independent claims for grants with kind B1/B2."""
    if not record.independent_claims:
        return 0

    kind = (record.kind or "").upper()
    if kind not in TARGET_INDEPENDENT_KINDS:
        return 0

    pub_id = _compose_pub_id(record.pub_id, kind)
    staged = insert_independent_claims(conn, pub_id, record.independent_claims)
    if staged:
        logger.info(f"Staged {staged} independent claims for {pub_id}")
    return staged


@dataclass
class ProcessingStats:
    """Statistics for processing operations."""

    total_processed: int = 0
    total_updated: int = 0
    total_skipped: int = 0
    files_processed: int = 0
    files_failed: int = 0


# -----------
# XML Parsing
# -----------

def extract_text_recursive(element: ET.Element, exclude_tags: set[str] | None = None) -> str:
    """Recursively extract plain text from XML element, excluding specified tags.

    Args:
        element: XML element to extract text from.
        exclude_tags: Set of tag names to exclude from extraction.

    Returns:
        Plain text string with whitespace normalized and proper punctuation spacing.
    """
    if exclude_tags is None:
        exclude_tags = set()

    parts: list[str] = []

    # Add element's own text (don't strip - preserve leading/trailing spaces)
    if element.text:
        parts.append(element.text)

    # Recursively process children
    for child in element:
        # Skip excluded tags
        if child.tag in exclude_tags:
            # Still need to process tail text after excluded tags
            if child.tail:
                parts.append(child.tail)
            continue

        # Add child text recursively
        child_text = extract_text_recursive(child, exclude_tags)
        if child_text:
            parts.append(child_text)

        # Add tail text (text after closing tag) - don't strip
        if child.tail:
            parts.append(child.tail)

    # Join parts without adding extra spaces
    text = "".join(parts)

    # Normalize whitespace: collapse multiple spaces/newlines into single space
    text = re.sub(r"\s+", " ", text).strip()

    # Fix spacing around punctuation - remove spaces before punctuation
    text = re.sub(r"\s+([.,;:!?])", r"\1", text)

    return text


def extract_abstract(app_elem: ET.Element) -> str | None:
    """Extract plain text abstract from <us-patent-application> element.

    Args:
        app_elem: <us-patent-application> XML element.

    Returns:
        Plain text abstract or None if not found.
    """
    # Find <abstract> element (may be nested)
    abstract_elem = app_elem.find(".//abstract")
    if abstract_elem is None:
        return None

    text = extract_text_recursive(abstract_elem)
    return text if text else None


def _extract_publication_field(app_elem: ET.Element, field: str) -> str | None:
    """Return the first value for a given field under publication-reference/document-id."""
    pub_ref = app_elem.find(".//publication-reference/document-id")
    if pub_ref is None:
        return None

    field_elem = pub_ref.find(field)
    if field_elem is None or field_elem.text is None:
        return None

    value = field_elem.text.strip()
    return value or None


def extract_publication_doc_number(app_elem: ET.Element) -> str | None:
    """Return the first <doc-number> under <publication-reference>/<document-id>."""
    return _extract_publication_field(app_elem, "doc-number")


def extract_publication_kind(app_elem: ET.Element) -> str | None:
    """Return the first <kind> under <publication-reference>/<document-id>."""
    return _extract_publication_field(app_elem, "kind")


def extract_application_number(app_elem: ET.Element) -> str | None:
    """Return doc-number from the first utility application-reference, fallback to first reference."""
    application_refs = app_elem.findall(".//application-reference")
    fallback: str | None = None

    for app_ref in application_refs:
        doc_id = app_ref.find("document-id")
        if doc_id is None:
            continue

        doc_elem = doc_id.find("doc-number")
        if doc_elem is None or doc_elem.text is None:
            continue

        value = doc_elem.text.strip()
        if not value:
            continue

        appl_type = (app_ref.attrib.get("appl-type") or "").strip().lower()
        if appl_type == "utility":
            return value
        if fallback is None:
            fallback = value

    return fallback


_CLAIM_NUM_PATTERN = re.compile(r"\d+")


def _parse_claim_number(claim_elem: ET.Element) -> int | None:
    """Extract claim number from attributes or nested elements."""
    for attr in ("num", "number", "claim-number", "claim_num"):
        value = claim_elem.attrib.get(attr)
        if value:
            match = _CLAIM_NUM_PATTERN.search(value)
            if match:
                return int(match.group())

    for tag in ("claim-number", "claim-num"):
        number_elem = claim_elem.find(f".//{tag}")
        if number_elem is not None and number_elem.text:
            match = _CLAIM_NUM_PATTERN.search(number_elem.text)
            if match:
                return int(match.group())
    return None


def _is_independent_claim(claim_elem: ET.Element) -> bool:
    """Determine whether a claim element is independent."""
    claim_type = (
        claim_elem.attrib.get("claim-type")
        or claim_elem.attrib.get("type")
        or claim_elem.attrib.get("claim_type")
    )
    if claim_type and claim_type.strip().lower() == "independent":
        return True

    depends_on = (
        claim_elem.attrib.get("depends-on")
        or claim_elem.attrib.get("depends_on")
        or claim_elem.attrib.get("dependson")
    )
    if depends_on:
        return False

    # Some XMLs mark dependencies via nested claim-ref elements.
    claim_ref = claim_elem.find(".//claim-ref")
    if claim_ref is not None and claim_ref.attrib.get("idref"):
        return False

    return True


def extract_claims(app_elem: ET.Element) -> tuple[str | None, list[PatentClaim]]:
    """Extract plain text claims from <us-patent-application> element.

    Excludes <us-claim-statement> tags and inserts newlines at each <claim-text> opening tag.
    Skips claims that contain "(canceled)" or "(cancelled)".

    Args:
        app_elem: <us-patent-application> XML element.

    Returns:
        Tuple of (claims_text, independent_claims).
    """
    # Find <claims> element (may be nested)
    claims_elem = app_elem.find(".//claims")
    if claims_elem is None:
        return None, []

    # Find all <claim> elements
    claim_elems = claims_elem.findall(".//claim")
    if not claim_elems:
        return None, []

    claim_parts: list[str] = []
    independent_claims: list[PatentClaim] = []

    for claim_elem in claim_elems:
        claim_segments: list[str] = []

        # Find all <claim-text> elements within this claim
        claim_text_elems = claim_elem.findall(".//claim-text")

        for ct_elem in claim_text_elems:
            # Extract text excluding <us-claim-statement>
            text = extract_text_recursive(ct_elem, exclude_tags={"us-claim-statement"})

            # Skip canceled/cancelled claims
            if text and ("(canceled)" in text.lower() or "(cancelled)" in text.lower()):
                continue

            if text:
                claim_parts.append(text)
                claim_segments.append(text)

        claim_text_full = " ".join(claim_segments).strip()
        if not claim_text_full:
            continue

        if _is_independent_claim(claim_elem):
            claim_number = _parse_claim_number(claim_elem)
            if claim_number is not None:
                independent_claims.append(
                    PatentClaim(
                        claim_number=claim_number,
                        claim_text=claim_text_full,
                        is_independent=True,
                    )
                )

    if not claim_parts:
        return None, []

    # Join with newlines to separate claim texts
    claims_text = "\n".join(claim_parts)
    return claims_text, independent_claims


def extract_pub_id(app_elem: ET.Element) -> str | None:
    """Extract publication ID from <us-patent-application> element.

    Constructs pub_id as {country}-{doc_number}-{kind}.

    Args:
        app_elem: <us-patent-application> XML element.

    Returns:
        Publication ID string or None if components missing.
    """
    # Find <publication-reference> element
    pub_ref = app_elem.find(".//publication-reference/document-id")
    if pub_ref is None:
        return None

    country_elem = pub_ref.find("country")
    doc_num_elem = pub_ref.find("doc-number")
    kind_elem = pub_ref.find("kind")

    if country_elem is None or doc_num_elem is None or kind_elem is None:
        return None

    country = country_elem.text.strip() if country_elem.text else ""
    doc_number = doc_num_elem.text.strip() if doc_num_elem.text else ""
    kind = kind_elem.text.strip() if kind_elem.text else ""

    if not (country and doc_number and kind):
        return None
    if kind == "B2" or kind == "B1":
        logger.info(f"Extracted pub_id: {country}-{doc_number}-{kind}")
    return f"{country}-{doc_number}-{kind}"


def extract_pub_id_without_kind(app_elem: ET.Element) -> str | None:
    """Extract publication ID without kind code from XML element.

    Constructs pub_id as {country}-{doc_number} (without kind).

    Args:
        app_elem: XML element (<us-patent-grant> or <us-patent-application>).

    Returns:
        Publication ID string or None if components missing.
    """
    # Find <publication-reference> element
    pub_ref = app_elem.find(".//publication-reference/document-id")
    if pub_ref is None:
        return None

    country_elem = pub_ref.find("country")
    doc_num_elem = pub_ref.find("doc-number")

    if country_elem is None or doc_num_elem is None:
        return None

    country = country_elem.text.strip() if country_elem.text else ""
    doc_number = doc_num_elem.text.strip() if doc_num_elem.text else ""

    if not (country and doc_number):
        return None

    return f"{country}-{doc_number}"


def parse_xml_file(xml_path: str) -> Iterator[PatentFullText]:
    """Parse USPTO bulk XML file and yield PatentFullText records.

    USPTO bulk XML files contain multiple <us-patent-application> root elements
    without a single wrapping element. This function wraps the file content
    to create valid XML for parsing.

    Args:
        xml_path: Path to XML file.

    Yields:
        PatentFullText instances.
    """
    logger.info(f"Parsing XML file: {xml_path}")

    count = 0

    # Read and wrap the file to handle multiple root elements
    with open(xml_path, encoding='utf-8') as f:
        # Read first few lines to check for XML declaration
        f.seek(0)

        # Create a temporary wrapped XML string for each application
        # We'll parse applications one at a time to minimize memory usage
        buffer = []
        in_application = False
        in_patent = False
        depth = 0

        for line in f:
            # Skip XML declaration lines
            if line.strip().startswith('<?xml'):
                continue
            if line.strip().startswith('<!DOCTYPE'):
                continue

            # Track when we enter/exit us-patent-application
            if '<us-patent-application' in line:
                in_application = True
                depth += line.count('<us-patent-application')
                buffer.append(line)
            elif in_application:
                buffer.append(line)
                # Track nesting depth
                depth += line.count('<us-patent-application')
                depth -= line.count('</us-patent-application>')

                # When we've closed all applications, parse the buffer
                if depth == 0:
                    count += 1
                    xml_string = ''.join(buffer)

                    try:
                        elem = ET.fromstring(xml_string)

                        pub_id = extract_pub_id(elem)
                        if not pub_id:
                            logger.error(f"Record {count}: missing pub_id, skipping")
                            buffer = []
                            in_application = False
                            continue
                        doc_number = extract_publication_doc_number(elem)
                        kind_value = extract_publication_kind(elem)
                        application_number = extract_application_number(elem)

                        abstract = extract_abstract(elem)
                        claims_text, independent_claims = extract_claims(elem)

                        # Only yield if we have at least one field to update
                        if abstract or claims_text:
                            yield PatentFullText(
                                pub_id=pub_id,
                                abstract=abstract,
                                claims_text=claims_text,
                                kind=kind_value,
                                doc_number=doc_number,
                                application_number=application_number,
                                independent_claims=independent_claims,
                            )
                        else:
                            logger.info(f"Record {count} ({pub_id}): no abstract or claims found")

                    except Exception as e:
                        logger.error(f"Error parsing record {count}: {e}")

                    finally:
                        # Clear buffer for next application
                        buffer = []
                        in_application = False
            elif '<us-patent-grant' in line:
                in_patent = True
                depth += line.count('<us-patent-grant')
                buffer.append(line)
            elif in_patent:
                buffer.append(line)
                # Track nesting depth
                depth += line.count('<us-patent-grant')
                depth -= line.count('</us-patent-grant>')

                # When we've closed all applications, parse the buffer
                if depth == 0:
                    count += 1
                    xml_string = ''.join(buffer)

                    try:
                        elem = ET.fromstring(xml_string)

                        # For patent grants, extract pub_id without kind code
                        pub_id = extract_pub_id_without_kind(elem)
                        if not pub_id:
                            logger.error(f"Record {count}: missing pub_id, skipping")
                            buffer = []
                            in_patent = False
                            continue
                        doc_number = extract_publication_doc_number(elem)
                        kind = extract_publication_kind(elem)
                        application_number = extract_application_number(elem)

                        abstract = extract_abstract(elem)
                        claims_text, independent_claims = extract_claims(elem)

                        # Only yield if we have at least one field to update
                        if abstract or claims_text:
                            yield PatentFullText(
                                pub_id=pub_id,
                                abstract=abstract,
                                claims_text=claims_text,
                                kind=kind,
                                doc_number=doc_number,
                                application_number=application_number,
                                independent_claims=independent_claims,
                            )
                        else:
                            logger.info(f"Record {count} ({pub_id}): no abstract or claims found")

                    except Exception as e:
                        logger.error(f"Error parsing record {count}: {e}")

                    finally:
                        # Clear buffer for next application
                        buffer = []
                        in_patent = False

    logger.info(f"Finished parsing {count} records from {xml_path}")


# ----------------------
# Postgres upsert stage
# ----------------------

def upsert_fulltext(conn: PgConn, record: PatentFullText) -> bool:
    """Upsert abstract, claims_text, and optionally pub_id/kind_code for existing patent_staging record.

    Args:
        conn: Postgres connection.
        record: PatentFullText instance to upsert.

    Returns:
        True if record was updated, False if record not found in staging.

    Raises:
        Exception: For database errors that should be handled by caller.
    """
    with conn.cursor() as cur:
        # Always search using the original pub_id (without kind)
        cur.execute(CHECK_RECORD_EXISTS_SQL, {"pub_id": record.pub_id})
        exists = cur.fetchone() is not None

        if not exists:
            if record.application_number:
                normalized_pub_id = _compose_pub_id(record.pub_id, record.kind)
                cur.execute(
                    UPDATE_STAGING_BY_APPLICATION_SQL,
                    {
                        "application_doc_number": record.application_number,
                        "pub_id": normalized_pub_id,
                        "abstract": record.abstract,
                        "claims_text": record.claims_text,
                        "kind_code": record.kind,
                    },
                )
                updated_by_app = cur.fetchone() is not None
                if updated_by_app:
                    logger.info(
                        "Updated via application_number match (%s -> %s)",
                        record.application_number,
                        normalized_pub_id,
                    )
                    return True

            return False

        # If kind is present, update pub_id to append kind and set kind_code
        if record.kind:
            cur.execute(
                UPDATE_STAGING_WITH_KIND_SQL,
                {
                    "pub_id": record.pub_id,
                    "abstract": record.abstract,
                    "claims_text": record.claims_text,
                    "kind_code": record.kind,
                },
            )
            updated = cur.fetchone() is not None
            if updated:
                logger.info(f"Updated {record.pub_id} -> {record.pub_id}-{record.kind} with kind_code={record.kind}")
            else:
                logger.error(f"Failed to update {record.pub_id}")
        else:
            # No kind, just update abstract and claims_text
            cur.execute(
                UPDATE_STAGING_SQL,
                {
                    "pub_id": record.pub_id,
                    "abstract": record.abstract,
                    "claims_text": record.claims_text,
                },
            )
            updated = cur.fetchone() is not None
            if updated:
                logger.info(f"Updated {record.pub_id}")
            else:
                logger.error(f"Failed to update {record.pub_id}")

        return updated


def upsert_fulltext_with_retry(
    conn: PgConn,
    record: PatentFullText,
    dsn: str,
    max_retries: int = 2
) -> tuple[bool, PgConn]:
    """Upsert with automatic reconnection on connection loss.

    Args:
        conn: Current database connection.
        record: PatentFullText instance to upsert.
        dsn: PostgreSQL DSN for reconnection.
        max_retries: Maximum number of retry attempts.

    Returns:
        Tuple of (success, connection) where connection may be a new connection.
    """
    for attempt in range(max_retries):
        try:
            # Check connection health before attempting operation
            if not is_connection_alive(conn):
                logger.error("Connection lost, attempting to reconnect...")
                with contextlib.suppress(Exception):
                    conn.close()
                conn = create_connection(dsn)

            result = upsert_fulltext(conn, record)
            return result, conn

        except (
            psycopg.OperationalError,
            psycopg.InterfaceError,
            psycopg.errors.IdleInTransactionSessionTimeout
        ) as e:
            logger.error(f"Database connection error on attempt {attempt + 1}: {e}")

            # Try to safely rollback
            safe_rollback(conn)
            if attempt < max_retries - 1:
                # Reconnect and retry
                with contextlib.suppress(Exception):
                    conn.close()

                logger.info("Reconnecting to database...")
                conn = create_connection(dsn)
            else:
                logger.error(f"Failed to process record {record.pub_id} after {max_retries} attempts")
                raise

    # Should never reach here, but for type safety
    return False, conn


# --------------------------
# File Processing Functions
# --------------------------

def process_single_file(
    xml_path: str,
    conn: PgConn,
    dsn: str,
    batch_size: int,
    dry_run: bool = False
) -> tuple[ProcessingStats, PgConn]:
    """Process a single XML file.

    Args:
        xml_path: Path to XML file.
        conn: Database connection.
        dsn: PostgreSQL DSN for reconnection.
        batch_size: Number of records to process before committing.
        dry_run: If True, parse but don't update database.

    Returns:
        Tuple of (ProcessingStats, connection) where connection may be reconnected.
    """
    stats = ProcessingStats()
    
    try:
        stream = parse_xml_file(xml_path)
        batch_count = 0

        for record in stream:
            stats.total_processed += 1
            batch_count += 1

            if dry_run:
                logger.info(
                    f"[DRY RUN] Would update {record.pub_id} "
                    f"(abstract: {bool(record.abstract)}, claims: {bool(record.claims_text)})"
                )
                continue

            try:
                # Use retry logic with automatic reconnection
                updated, conn = upsert_fulltext_with_retry(conn, record, dsn)

                if updated:
                    stats.total_updated += 1
                    maybe_stage_independent_claims(conn, record)
                else:
                    stats.total_skipped += 1

                # Commit in batches
                if batch_count >= batch_size:
                    try:
                        conn.commit()
                        logger.info(
                            f"[{Path(xml_path).name}] Committed batch: "
                            f"{stats.total_updated} updated, {stats.total_skipped} skipped, "
                            f"{stats.total_processed} total processed"
                        )
                        batch_count = 0
                    except (psycopg.OperationalError, psycopg.InterfaceError) as e:
                        logger.error(f"Failed to commit batch: {e}")
                        safe_rollback(conn)
                        # Reconnect after commit failure
                        with contextlib.suppress(Exception):
                            conn.close()
                        conn = create_connection(dsn)

            except Exception as e:
                logger.error(f"Error processing record {record.pub_id}: {e}", exc_info=True)
                safe_rollback(conn)
                batch_count = 0
                # Don't exit on error, continue processing
                continue

        # Commit remaining records
        if not dry_run and batch_count > 0:
            try:
                conn.commit()
                logger.info(f"[{Path(xml_path).name}] Committed final batch")
            except (psycopg.OperationalError, psycopg.InterfaceError) as e:
                logger.error(f"Failed to commit final batch: {e}")
                safe_rollback(conn)

        logger.info(
            f"[{Path(xml_path).name}] Completed: "
            f"{stats.total_processed} processed, "
            f"{stats.total_updated} updated, "
            f"{stats.total_skipped} skipped"
        )

    except Exception as e:
        logger.error(f"Failed to process file {xml_path}: {e}", exc_info=True)
        raise

    return stats, conn


def process_xml_files(
    xml_paths: list[str],
    dsn: str,
    batch_size: int,
    dry_run: bool = False
) -> ProcessingStats:
    """Process multiple XML files sequentially.

    Args:
        xml_paths: List of paths to XML files.
        dsn: PostgreSQL DSN.
        batch_size: Number of records to process before committing.
        dry_run: If True, parse but don't update database.

    Returns:
        Aggregated ProcessingStats for all files.
    """
    total_stats = ProcessingStats()
    conn = create_connection(dsn)
    
    if dry_run:
        logger.info(f"[DRY RUN] Processing {len(xml_paths)} file(s)")
        for xml_path in xml_paths:
            try:
                file_stats, _ = process_single_file(xml_path, conn, dsn, batch_size, dry_run=True)
                total_stats.total_processed += file_stats.total_processed
                total_stats.files_processed += 1
            except Exception as e:
                logger.error(f"Failed to process {xml_path}: {e}")
                total_stats.files_failed += 1
        
        logger.info(
            f"[DRY RUN] Summary: {total_stats.files_processed} files processed, "
            f"{total_stats.files_failed} files failed, "
            f"{total_stats.total_processed} total records"
        )
        return total_stats

    # Connect to database for real processing
    logger.info(f"Processing {len(xml_paths)} file(s) with batch size {batch_size}")
    logger.info(f"Connecting to database: {dsn.split('@')[-1]}")

    try:
        for i, xml_path in enumerate(xml_paths, 1):
            logger.info(f"Processing file {i}/{len(xml_paths)}: {xml_path}")
            
            try:
                file_stats, conn = process_single_file(xml_path, conn, dsn, batch_size, dry_run=False)
                
                # Aggregate statistics
                total_stats.total_processed += file_stats.total_processed
                total_stats.total_updated += file_stats.total_updated
                total_stats.total_skipped += file_stats.total_skipped
                total_stats.files_processed += 1
                
            except Exception as e:
                logger.error(f"Failed to process file {xml_path}: {e}", exc_info=True)
                total_stats.files_failed += 1
                safe_rollback(conn)
                # Continue with next file
                continue

    finally:
        # Ensure connection is closed
        try:
            conn.close()
            logger.info("Database connection closed")
        except Exception as e:
            logger.error(f"Error closing connection: {e}")

    logger.info(
        f"All files processed: {total_stats.files_processed} succeeded, "
        f"{total_stats.files_failed} failed, "
        f"{total_stats.total_processed} total records processed, "
        f"{total_stats.total_updated} updated, "
        f"{total_stats.total_skipped} skipped"
    )

    return total_stats


# -----------
# CLI / main
# -----------

def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments namespace.
    """
    p = argparse.ArgumentParser(
        description="Load patent full text from USPTO XML into patent_staging table",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process a single file
  %(prog)s ipa250220.xml

  # Process multiple files
  %(prog)s ipa250220.xml ipa250221.xml ipa250222.xml

  # Process all XML files in a directory
  %(prog)s data/*.xml

  # Dry run to test parsing
  %(prog)s --dry-run ipa250220.xml
        """
    )
    p.add_argument(
        "xml_files",
        nargs="+",
        help="Path(s) to USPTO bulk XML file(s) (e.g., ipa250220.xml)",
    )
    p.add_argument(
        "--dsn",
        default=os.getenv("PG_DSN", ""),
        help="Postgres DSN (default: PG_DSN env var)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse XML but do not write to Postgres",
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Commit every N records (default: 100)",
    )

    return p.parse_args()


def main() -> int:
    """Main execution function.

    Returns:
        Exit code (0 for success, non-zero for errors).
    """
    args = parse_args()

    if not args.dry_run and not args.dsn:
        logger.error("PG_DSN not set and --dsn not provided")
        return 2

    # Validate all files exist
    missing_files = [f for f in args.xml_files if not os.path.exists(f)]
    if missing_files:
        logger.error(f"XML file(s) not found: {', '.join(missing_files)}")
        return 2

    # Process all files
    stats = process_xml_files(
        xml_paths=args.xml_files,
        dsn=args.dsn,
        batch_size=args.batch_size,
        dry_run=args.dry_run
    )

    # Return non-zero if any files failed
    if stats.files_failed > 0:
        logger.error(f"Processing completed with {stats.files_failed} file(s) failed")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
