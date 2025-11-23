# SynapseIP

> SynapseIP is a data and analytics platform for artificial intelligence (AI) and machine learning (ML) IP. The platform blends hybrid semantic search, trend analytics, IP overview graphing, and proactive alerts on top of a pgvector-powered corpus that is refreshed by automated ETL pipelines. Current corpus includes 56k+ AI/ML-related patents and publications dating back to 2023, with support for multiple data sources including BigQuery, USPTO ODP API, and bulk XML feeds.

## Overview
The repository contains the full SynapseIP stack: FastAPI exposes the search, export, trend, saved-query, and overview endpoints; Next.js 15 App Router (React 19) provides the Auth0-gated UI and API proxy; multiple ETL pipelines (BigQuery, USPTO API, bulk XML) with AI embeddings keep the corpus current; and a Mailgun-capable alerts runner notifies subscribers when new filings match their saved scopes. User-specific IP overview analysis tables enable personalized AI/ML IP landscape exploration with isolated graph computation.

## Feature Highlights
- Hybrid keyword + vector search with semantic embeddings, adaptive result trimming, CSV/PDF export, and patent/application detail expansion ([app/api.py](app/api.py), [app/page.tsx](app/page.tsx)). 
- Auth0-protected React UI with saved-alert management, login overlay, and modal workspace for alert toggles ([components/NavBar.tsx](components/NavBar.tsx), [app/layout.tsx](app/layout.tsx)).
- IP Overview that surfaces saturation, activity rates, momentum, and CPC distribution for focus keyword(s) and/or CPC(s), with optional group by assignee signals ([app/overview_api.py](app/overview_api.py), [app/overview_signals.py](app/overview_signals.py), [components/SigmaOverviewGraph.tsx](components/SigmaOverviewGraph.tsx), [app/overview/page.tsx](app/overview/page.tsx)). 
  - Semantic neighbors are dropped when distances jump or exceed a threshold so the counts and timelines stay focused on relevant patents and publications.
- Scope Analysis page adds a preliminary freedom-to-operate (FTO) and infringement-risk tool to the platform: input subject matter of interest (e.g., a product description or draft claim set) and run a KNN search against every embedded independent claim to get a similarity node graph and results table with patent information and similarity-scored claims displayed inline. Results table and similarity scoring information is exportable in PDF format. ([app/api.py](app/api.py#L147), [app/repository.py](app/repository.py#L593), [app/scope-analysis/page.tsx](app/scope-analysis/page.tsx)).
- Canonical assignee name normalization for improved entity matching and trend analysis ([add_canon_name.py](add_canon_name.py)).
- Multiple data ingestion pipelines: BigQuery loader ([etl.py](etl.py)), USPTO PEDS API loader ([etl_uspto.py](etl_uspto.py)), and bulk XML parser ([etl_xml_fulltext.py](etl_xml_fulltext.py)) for comprehensive patent and application coverage.
- Embedding backfill utility for maintaining vector search quality across historical data ([etl_add_embeddings.py](etl_add_embeddings.py)).
- Automated Mailgun/console alert notifications for saved queries packaged as standalone runner ([alerts_runner.py](alerts_runner.py)).
- Comprehensive pytest suite covering authentication, repository search logic, overview signal math, and API contracts ([tests/](tests/)).

## Live Deployment
- App: https://www.synapse-ip.com/
- Demo login: `phaethon@phaethon.llc` / `pollc123#` (Auth0 username/password grant)

## Architecture
```text
                         ┌───────────────────────┐
                         │         Auth0         │
                         └──────────┬────────────┘
                                    │
┌────────────────────────┐   OIDC   │
│ Next.js App Router UI  │◄─────────┘
│ (React 19, Auth0 SDK)  │
└───────────┬────────────┘
            │ /api/* proxy               async pg pool
            ▼                                     │
┌────────────────────────┐        ┌────────────────────────────┐
│ FastAPI service        │◄──────►│ Postgres + pgvector        │
│ app/api.py             │        │ patent, embeddings, alerts │
│ └─ overview_api.py     │        └─────────┬──────────────────┘
└───────────┬────────────┘                  │
            │                               │
            │                       ┌──────────────────────────┐
            │                       │ BigQuery + OpenAI ETL    │
            │                       │ etl.py                   │
            │                       └────────┬─────────────────┘
            │                                │ saved query delta
            │                                │                               
            ▼                                ▼ 
┌────────────────────────┐         ┌──────────────────────────┐
│ Alerts runner          │────────►│  Mailgun/                │───► (subscribers)
│                        │         │  console notifications   │ 
│ alerts_runner.py       │         └──────────────────────────┘
└────────────────────────┘
```

## Tech Stack
- **Backend**: FastAPI 0.115+, Pydantic v2, psycopg 3 async pools, asyncpg 0.30+, aiosmtplib 4.0+, overview analytics with igraph, leidenalg, umap-learn, and scikit-learn ([app/](app/)).
  - [DATABASE_SCHEMA](DATABASE_SCHEMA.md)
- **Frontend**: Next.js 15.5, React 19.1, Auth0 React SDK 2.4, Sigma.js 3.0-beta, Graphology 0.25, Force-Atlas2 layout, Tailwind CSS 3.4, TypeScript 5.9 ([app/*.tsx](app/), [components/](components/)).
- **Data Pipelines**: Google BigQuery, USPTO PEDS API, USPTO bulk XML parsing, OpenAI `text-embedding-3` models ([etl.py](etl.py), [etl_uspto.py](etl_uspto.py), [etl_xml_fulltext.py](etl_xml_fulltext.py)).
- **Infrastructure & Tooling**: Postgres 15+ with pgvector, Alembic migrations, pytest with asyncio support, Ruff linting, pip-tools lockfiles, Docker containerization ([migrations/](migrations/), [tests/](tests/)).

## Repository Layout
```
├── app/
│   ├── api.py                       # FastAPI application (search, export, trends, scope, billing)
│   ├── overview_api.py              # IP overview graph router mounted into the API
│   ├── payment_api.py               # Stripe customer portal + billing endpoints
│   ├── stripe_config.py             # Stripe client bootstrap helpers
│   ├── stripe_webhooks.py           # Webhook verification + processing
│   ├── subscription_middleware.py   # Shared subscription enforcement logic
│   ├── repository.py                # SQL query builders & search logic
│   ├── schemas.py                   # Pydantic models shared by API + clients
│   ├── db.py, db_errors.py          # Async Postgres connection pooling helpers
│   ├── auth.py, config.py           # Auth0 JWT validation + settings
│   ├── embed.py, overview_signals.py  # Embedding helpers & overview calculations
│   ├── observability.py             # GlitchTip / telemetry bootstrap
│   ├── instrumentation.ts           # Server-side instrumentation hook for Next.js
│   ├── api/                         # Next.js Route Handlers proxying backend services
│   │   ├── search/, scope-analysis/, overview/  # Patent search + graph proxies
│   │   ├── trend/, export/, patent-date-range/  # Analytics + CSV/PDF exports
│   │   ├── saved-queries/           # Alert CRUD handlers
│   │   └── glitchtip-example-api/   # Observability demo endpoints
│   ├── page.tsx                     # Landing + patent search UI
│   ├── overview/page.tsx            # Graph-based overview explorer
│   ├── scope-analysis/page.tsx      # Claim scope analysis UI
│   ├── billing/page.tsx             # Customer billing portal
│   ├── docs/(privacy|tos|dpa)/      # Legal & compliance content
│   ├── help/(search_trends|overview|scope-analysis)/ # Product documentation pages
│   ├── glitchtip-example-page/      # Client-side observability demo
│   ├── global-error.tsx, layout.tsx, providers.tsx
│   ├── globals.css,                # Client-side observability demo
│   └── robots.ts
├── components/
│   ├── NavBar.tsx                   # Auth-aware navigation & alert modal trigger
│   ├── HomePageClient.tsx           # Client-side interactivity for the landing/search page
│   ├── SigmaOverviewGraph.tsx       # Sigma.js renderer for overview graphs
│   ├── SubscriptionRequired.tsx     # Subscription gate wrapper
│   ├── GlitchtipInit.tsx            # Front-end telemetry bootstrap
│   └── billing/                     # PricingPlans & SubscriptionStatus widgets
├── infrastructure/
│   └── logger.py                    # Structured logging helper for API + jobs
├── tests/                           # pytest suite (API, repository, signals, auth, billing)
│   ├── test_api.py, test_auth.py, test_config.py, test_db.py
│   ├── test_embed.py, test_repository.py, test_alerts_runner.py
│   ├── test_overview_signals.py, test_overview_utils.py
│   └── test_subscription_middleware.py, conftest.py
├── migrations/                      # Alembic environment + versions
│   ├── env.py, script.py.mako       # Migration configuration
│   └── versions/                    # Schema migrations (overview, billing, user tables)
├── docs/
│   ├── screenshots/                 # UI & API images
│   └── uspto_odp_api/               # USPTO API schema reference
├── scripts/                              # Operational & maintenance scripts
│   ├── add_canon_name.py
│   ├── etl_uspto.py
│   ├── etl_xml_fulltext.py
│   ├── etl_add_embeddings.py
│   ├── generate_citations_csv.py
│   ├── independent_claims_embeddings.py 
│   ├── process_patent_citations.py
│   ├── update_patent_staging.py
│   └── update_stripe_prices.py 
├── public/                          # Static assets (favicons, logos, etc.)
├── types/                           # TypeScript ambient declarations
├── instrumentation.ts & -client.ts  # Next.js instrumentation entrypoints
├── alerts_runner.py, etl.py         # Automated chron jobs
├── Dockerfile & start.sh            # Container build + entrypoint (runs Alembic)
├── next.config.js, package.json, et al.  # Next.js workspace + build configuration
├── pyproject.toml                   # Python packaging 
├── requirements.txt                 # Python dependency reqs
├── DATABASE_SCHEMA.md               # Reference documentation
└── LICENSE.md                       # Proprietary license
```

## Setup

### Prerequisites
- Python 3.13+
- Node.js 20+ (Next.js 15 target)
- Postgres 15+ with the `pgvector` extension enabled
- Auth0 tenant (Machine-to-Machine + SPA apps) and an OpenAI API key
- Optional: Google Cloud project for BigQuery access, Mailgun account for alerts

### Backend (FastAPI)
```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg://user:pass@host:5432/dbname"
export SQLALCHEMY_DATABASE_URI="$DATABASE_URL"
uvicorn app.api:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Next.js)
```bash
npm install
echo "NEXT_PUBLIC_AUTH0_DOMAIN=..." >> .env.local
echo "NEXT_PUBLIC_AUTH0_CLIENT_ID=..." >> .env.local
echo "NEXT_PUBLIC_AUTH0_AUDIENCE=..." >> .env.local
echo "BACKEND_URL=http://localhost:8000" >> .env.local
npm run dev   # http://localhost:3000
```
Next.js route handlers under `app/api/*` forward requests to the FastAPI service and preserve the `Authorization` header so Auth0 access tokens remain valid end-to-end.

### Docker (API only)
```bash
docker build -t synapseip .
docker run --rm -p 8000:8000 --env-file .env synapseip
```
The bundled `start.sh` executes `alembic upgrade head` before launching Uvicorn.

### Running Tests
```bash
pytest
```
Unit and integration tests cover search repository queries, API endpoints, Auth0 config validation, IP Overview signals, and database helpers.

## Environment Variables

### Backend / FastAPI
- `DATABASE_URL` – Primary Postgres DSN (required).
- `SQLALCHEMY_DATABASE_URI` – Matching DSN for Alembic migrations (required).
- `AUTH0_DOMAIN` / `AUTH0_API_AUDIENCE` – Issuer + audience for JWT validation.
- `CORS_ALLOW_ORIGINS` – Comma-separated allowlist for the API gateway.

- `OPENAI_API_KEY` – Enables semantic queries, PDF export enrichment, and ETL embeddings.
- `EMBEDDING_MODEL` / `SEMANTIC_TOPK` / `SEMANTIC_JUMP` / `VECTOR_TYPE` – Hybrid search tuning knobs.
- `EXPORT_MAX_ROWS` / `EXPORT_SEMANTIC_TOPK` – Export limits shared by CSV/PDF generators.
- `OVERVIEW_EMBEDDING_MODEL` – Preferred embedding suffix for IP Overview analytics (falls back to `WS_EMBEDDING_MODEL` for legacy deployments).
- `OVERVIEW_SEMANTIC_DIST_CAP` – Absolute cosine-distance ceiling (set ≤ 0 to disable) for overview semantic neighbors; defaults to 0.9.
- `OVERVIEW_SEMANTIC_SPREAD` – Maximum delta from the closest semantic result before pruning (defaults to 0.35).
- `OVERVIEW_SEMANTIC_JUMP` – Distance jump threshold that stops adding additional neighbors once the relevance curve has a sharp break (defaults to 0.10).

### Frontend / Next.js
- `NEXT_PUBLIC_AUTH0_DOMAIN`
- `NEXT_PUBLIC_AUTH0_CLIENT_ID`
- `NEXT_PUBLIC_AUTH0_AUDIENCE`
- `BACKEND_URL` – Origin of the FastAPI service consumed by proxy routes.
- `NEXT_PUBLIC_GLITCHTIP_DSN` – Optional: browser GlitchTip DSN to capture client errors.
- `NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT` / `NEXT_PUBLIC_GLITCHTIP_RELEASE` – Optional metadata for GlitchTip issues.
- `NEXT_PUBLIC_GLITCHTIP_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_GLITCHTIP_PROFILES_SAMPLE_RATE` – Optional performance sampling (0–1).

### ETL & Alerts
- `GOOGLE_APPLICATION_CREDENTIALS` – Service account JSON for BigQuery reader access.
- `AI_CPC_REGEX` – Optional override of CPC filter regex applied in the ETL.
- `MAILGUN_DOMAIN` / `MAILGUN_API_KEY` / `MAILGUN_FROM_NAME` / `MAILGUN_FROM_EMAIL` / `MAILGUN_BASE_URL` – Alert delivery configuration (falls back to console logging when unset).
- `EMB_BATCH_SIZE` / `EMB_MAX_CHARS` – Embedding throughput guards used by `etl.py`.

### Observability (FastAPI)
- `GLITCHTIP_DSN` – Optional: enable GlitchTip for backend exceptions.
- `GLITCHTIP_ENVIRONMENT` / `GLITCHTIP_RELEASE` – Optional metadata.
- `GLITCHTIP_TRACES_SAMPLE_RATE` / `GLITCHTIP_PROFILES_SAMPLE_RATE` – Optional performance sampling (0–1).

### GlitchTip Sourcemaps (Next.js)
- Install when ready: `npm i -E @sentry/nextjs` (GlitchTip speaks the Sentry protocol).
- Configure CI/CD with the following secrets for sourcemap uploads:
  - `GLITCHTIP_URL` (or `SENTRY_URL`) – e.g., `https://app.glitchtip.com`
  - `GLITCHTIP_AUTH_TOKEN` (same scopes as the Sentry CLI)
  - `GLITCHTIP_ORG` – GlitchTip org slug
  - `GLITCHTIP_PROJECT` – the project slug receiving frontend errors
- Optionally, create `.sentryclirc` (see `.sentryclirc.example`) instead of env vars.
- The build plugin is enabled automatically by `next.config.js` when `@sentry/nextjs` is present. Source maps are hidden from clients (`sentry.hideSourceMaps: true`) and uploaded to GlitchTip during production builds.

## Data Pipeline (`etl.py`)
`etl.py` loads AI/ML-related US patents and publications from Google’s public patent publication dataset, normalizes CPC codes, upserts metadata into Postgres, and generates embeddings for both title+abstract (`...|ta`) and claims (`...|claims`). Runs are idempotent via the `ingest_log` table and hash-based deduplication. Usage example:
```bash
python etl.py \
  --project gcp-project \
  --dsn "postgresql://user:pass@host/db?sslmode=require" \
  --date-from 2024-01-01 \
  --date-to 2024-02-01 \
  --embed --claims
```

## Alerts Runner (`alerts_runner.py`)
The alert runner replays saved queries, diffing against the last `alert_event` timestamp per query. Matching patents and publications are emailed through Mailgun (or printed to stdout when Mailgun is not configured). Run locally with:
```bash
python alerts_runner.py
```

## Additional Data Pipeline Scripts

### USPTO PEDS API Loader (`etl_uspto.py`)
Alternative to BigQuery ingestion, loads patent publication data directly from the USPTO Open Data Portal (ODP) API. Filters by CPC codes and AI keywords locally:
```bash
python etl_uspto.py \
  --dsn "postgresql://user:pass@host/db?sslmode=require" \
  --date-from 2024-01-01 \
  --date-to 2024-02-01 \
  --embed --claims
```

### USPTO Bulk XML Parser (`etl_xml_fulltext.py`)
Parses USPTO bulk XML files (weekly patent grant and publication feeds) to extract full-text abstracts and claims. Updates `patent_staging` table with parsed content:
```bash
python etl_xml_fulltext.py \
  --xml resources/ipa250220.xml \
  --dsn "postgresql://user:pass@host/db?sslmode=require"
```

### Embedding Backfill Utility (`etl_add_embeddings.py`)
Backfills missing embeddings for patents and applications within a specified date range. Supports both title+abstract (`|ta`) and claims (`|claims`) embedding models:
```bash
python etl_add_embeddings.py \
  --dsn "postgresql://user:pass@host/db?sslmode=require" \
  --date-from 2024-01-01 \
  --date-to 2024-02-01 \
  --model text-embedding-3-small \
  --suffix ta
```

### Canonical Assignee Normalizer (`add_canon_name.py`)
Generates canonical assignee names by removing common corporate suffixes (Inc., LLC, Corp., etc.) to improve entity matching and trend analysis. Creates entries in `canonical_assignee_name` and `assignee_alias` tables:
```bash
python add_canon_name.py \
  --dsn "postgresql://user:pass@host/db?sslmode=require"
```

## IP Overview
[app/overview_api.py](app/overview_api.py) serves two complementary functions:

- `/overview/overview` composes analysis and insights for IP Overview. For any keyword/CPC scope it returns exact and semantic saturation counts, activity rate (per month), momentum slope/CAGR with labeled Up/Flat/Down, top CPC slices, recent filing tallies (6/12/18/24 months), and the full monthly timeline used across the UI.
- `/overview/graph` builds a user-specific embedding graph when the optional “Group by Assignee” facet is enabled. It selects an embedding model (`OVERVIEW_EMBEDDING_MODEL`, falling back to `WS_EMBEDDING_MODEL`), computes cosine KNN neighborhoods, applies Leiden community detection, and scores intensity per grouping. Signal detection logic in [app/overview_signals.py](app/overview_signals.py) evaluates convergence, emerging gaps, crowd-out, and bridge opportunities.

The React UI ([app/overview/page.tsx](app/overview/page.tsx)) defaults to the overview primitives: four tiles (Crowding, Density, Momentum, Top CPCs), a timeline sparkline, CPC bar chart, and a patent results table with semantic toggle. Enabling “Group by Assignee” pulls in a Sigma.js visualization and signal cards for assignee clustering context.

## Screenshots
- Search & Trends UI – ![docs/screenshots/search-ui.png](docs/screenshots/search-ui.png)
- IP Overview UI – ![docs/screenshots/overview-ui.png](docs/screenshots/overview-ui.png)
- IP Overview UI (con't) - ![docs/screenshots/overview-ui-2.png](docs/screenshots/overview-ui-2.png)
- Scope Analysis UI - ![docs/screenshots/scope-ui.png](docs/screenshots/scope-ui.png)
- SynapseIP API Docs – ![docs/screenshots/api-docs.png](docs/screenshots/api-docs.png)

## Documentation & Legal Pages
- **Help Documentation**: Interactive help pages available at `/help`, including detailed guides for [Search & Trends](app/help/search_trends/page.tsx), [IP Overview](app/help/overview/page.tsx), and [Scope Analysis](app/help/scope-analysis/page.tsx).
- **Legal Pages**: Privacy policy ([app/docs/privacy/page.tsx](app/docs/privacy/page.tsx)), Terms of Service ([app/docs/tos/page.tsx](app/docs/tos/page.tsx)), and Data Processing Agreement ([app/docs/dpa/page.tsx](app/docs/dpa/page.tsx)).

## License
This repository is publicly viewable for portfolio purposes only. The code is proprietary.
Copyright © 2025 Phaethon Order LLC. All rights reserved.
See [LICENSE](LICENSE.md) for terms.

## Contact
Questions or support: [support@phaethon.llc](mailto:support@phaethon.llc).
