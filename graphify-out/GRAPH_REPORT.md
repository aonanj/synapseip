# Graph Report - synapseip  (2026-10-22)

## Corpus Check
- Large corpus: 160 files · ~683,221 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2249 nodes · 4469 edges · 138 communities (103 shown, 35 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 171 edges (avg confidence: 0.87)
- Token cost: 1,041,457 input · 0 output

## Community Hubs (Navigation)
- BigQuery ETL Core
- Citation Metrics & Risk Radar
- USPTO XML Application Parser
- USPTO XML Issued Patent Parser
- Overview Page UI
- Search API & Saved Queries
- Citation Page UI
- Shared Config & Stdlib Imports
- Independent Claim Embeddings
- Overview API Metrics
- ETL Embedding Backfill
- Alerts Runner
- Assignee Name Backfill
- Deprecated ETL
- USPTO ODP ETL
- API Endpoint Tests
- Next.js API Proxy Routes
- Home Page UI
- Alembic Migrations
- Assignee Canonicalization
- Issued Patent Checker
- Payment API
- Overview Signals
- DB Test Fixtures
- Subscription Middleware
- Package Metadata
- BQ Issued Patent Staging
- Repository Tests
- Subscription Middleware Tests
- Patent Staging Updater
- Sigma Overview Graph
- README, License & Stack
- Staged Patent Migration
- Billing UI
- Search Repository
- API Schemas Screenshot
- Citation Loader
- TypeScript Config
- GlitchTip Frontend Errors
- App Layout & Navigation
- Scope Analysis Page UI
- Stripe Config
- Citation CSV Processor
- Citation CSV Upsert
- Weekly ETL Workflow
- Help Page
- Scope Calibrated Scoring
- Database Schema Doc
- Stripe Subscription Webhooks
- Overview Graph Endpoint
- Search Trends Help Page
- Assignee Signal Builder
- Embedding KNN & Density
- Applications-to-Patents Updater
- Auth0 Integration
- Citation Help Page
- Overview Node Data
- BigQuery Assignee Backfill
- DB Pool & Settings
- Auth Tests
- Overview Help Page
- Stripe Event Backfill
- Citations CSV Generator
- SubscriptionInfo Model
- Overview Signals Screenshot
- Frontend Dependencies
- API Error & Delete Routes
- Embedding Tests
- Stripe Event Logging
- Cited Refs Assignee Backfill
- Legal Docs Index
- Scope Analysis Help Page
- Observability & Logging
- API Docs Screenshot
- Citation UI Screenshot
- Overview UI Screenshot
- Stripe Invoice Period Handling
- Scope UI Screenshot
- Patent Data JSON Schema
- DPA Page
- Privacy Page
- Terms of Service Page
- Encroachment UI Screenshot
- Search UI Screenshot
- Alembic Env
- Frontend Dev Dependencies
- Patent Claims Backfill
- Alerts Workflow & Tables
- Embeddings & HNSW Indexes
- Search PDF Export
- DB Error Classification
- Webhook Idempotency
- Banner Logo Image
- Short Banner Logo Image
- Middleware Test Mocks
- Stripe Webhook Endpoint
- Assignee Matching
- Overview Date Utilities
- Timeline Sparkline
- Claims Staging & Loaders
- Apple Touch Icon
- SynapseIP Logo Image
- Cited Assignee Raw Upsert
- Cluster Labeling
- Graphology Type Decls
- Forward Impact Schemas
- Graph Schemas
- Stripe Price Updater
- Next Instrumentation
- Dependency Matrix Schemas
- PatentScout Logo Image
- Signal Schemas
- Subscription Response Schemas
- Validation Error Schemas
- Overview Response Schemas
- Momentum Schemas
- Pricing Plan Schemas
- Saved Query Schemas
- Trend Schemas
- Favicon 16
- Favicon 32
- Apply Button Image
- PatentScout Icon Image
- Start Script
- CitationScope Schema
- CpcBreakdownItem Schema
- DateRange Schema
- Recency Schema
- Python Project Config

## God Nodes (most connected - your core abstractions)
1. `FakeAsyncConnection` - 42 edges
2. `FakeAsyncCursor` - 35 edges
3. `get_overview_graph()` - 31 edges
4. `SynapseIP README` - 29 edges
5. `next` - 28 edges
6. `Database Schema (PostgreSQL 17 on Neon)` - 28 edges
7. `fetchWithRetry()` - 26 edges
8. `setup_logger()` - 25 edges
9. `react` - 24 edges
10. `OverviewPage()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Alerts runner (alerts_runner.py)` --semantically_similar_to--> `alerts_runner.py job`  [INFERRED] [semantically similar]
  README.md → .github/workflows/alerts.yml
- `BigQuery ETL pipeline (etl.py)` --semantically_similar_to--> `scripts/big-query-etl/etl.py step`  [INFERRED] [semantically similar]
  README.md → .github/workflows/etl_weekly.yml
- `Embedding backfill utility` --semantically_similar_to--> `Embedding backfill step`  [INFERRED] [semantically similar]
  README.md → .github/workflows/etl_weekly.yml
- `Canonical assignee name normalization` --semantically_similar_to--> `Canonical assignee normalizer step`  [INFERRED] [semantically similar]
  README.md → .github/workflows/etl_weekly.yml
- `Issued patent checker` --semantically_similar_to--> `Issued patent checker step`  [INFERRED] [semantically similar]
  README.md → .github/workflows/etl_weekly.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Claim extraction, backfill and embedding pipeline** — scripts_backfill_claim_extraction, scripts_backfill_backfill_patent_claims, scripts_generate_embeddings_independent_claims_embeddings, database_schema_patent_claim, database_schema_patent_claim_embeddings [INFERRED 0.85]
- **Weekly ETL step sequence** — _github_workflows_etl_weekly_etl_script, _github_workflows_etl_weekly_embedding_backfill, _github_workflows_etl_weekly_canon_normalizer, _github_workflows_etl_weekly_issued_checker [EXTRACTED 1.00]
- **Assignee normalization tables** — database_schema_patent_assignee, database_schema_assignee_alias, database_schema_canonical_assignee_name, database_schema_cited_patent_assignee [EXTRACTED 1.00]
- **Scope Analysis request/response schemas** — docs_screenshots_api_docs_2_scopeanalysisrequest, docs_screenshots_api_docs_2_scopeanalysisresponse, docs_screenshots_api_docs_2_scopeclaimmatch [INFERRED 0.85]
- **Billing and subscription schemas** — docs_screenshots_api_docs_2_createcheckoutsessionrequest, docs_screenshots_api_docs_2_pricingplansresponse, docs_screenshots_api_docs_2_subscriptionstatusresponse, docs_screenshots_api_docs_2_customerportalresponse [INFERRED 0.75]
- **Risk Radar schemas** — docs_screenshots_api_docs_2_riskradarrequest, docs_screenshots_api_docs_2_riskradarresponse, docs_screenshots_api_docs_2_riskradarexportrequest, docs_screenshots_api_docs_2_patentriskmetrics [INFERRED 0.85]
- **SynapseIP API endpoint groups** — docs_screenshots_api_docs_overview_group, docs_screenshots_api_docs_citation_group, docs_screenshots_api_docs_payment_group, docs_screenshots_api_docs_default_group [EXTRACTED 1.00]
- **Citation UI competitive risk dashboard** — docs_screenshots_citation_ui_2_risk_radar_panel, docs_screenshots_citation_ui_2_assignee_encroachment_panel, docs_screenshots_citation_ui_2_encroachment_timeline_chart, docs_screenshots_citation_ui_2_encroachment_score_table [INFERRED 0.85]
- **Scope-driven citation widgets** — docs_screenshots_citation_ui_scope_panel, docs_screenshots_citation_ui_forward_citation_impact, docs_screenshots_citation_ui_cross_assignee_dependency [EXTRACTED 1.00]
- **Four overview-potential signals evaluated per assignee** — docs_screenshots_overview_ui_2_sparse_focus_area, docs_screenshots_overview_ui_2_bridge_opportunity, docs_screenshots_overview_ui_2_crowd_out_risk, docs_screenshots_overview_ui_2_focus_convergence [EXTRACTED 1.00]
- **IP Overview analytics dashboard panels** — docs_screenshots_overview_ui_scope_metrics, docs_screenshots_overview_ui_timeline_chart, docs_screenshots_overview_ui_cpc_distribution, docs_screenshots_overview_ui_results_table [INFERRED 0.85]
- **Scope Analysis results views driven by one search** — docs_screenshots_scope_ui_similarity_map, docs_screenshots_scope_ui_claim_proximity_breakdown, docs_screenshots_scope_ui_closest_patent_claims_table [INFERRED 0.85]
- **Search & Trends page panels: filters, trend chart, results** — docs_screenshots_search_ui_search_filter_panel, docs_screenshots_search_ui_trend_chart, docs_screenshots_search_ui_results_list [EXTRACTED 1.00]
- **Icons connected to central chip by circuit traces** — public_apple_touch_icon_central_chip, public_apple_touch_icon_lightbulb, public_apple_touch_icon_bar_chart, public_apple_touch_icon_document, public_apple_touch_icon_magnifier [INFERRED 0.85]
- **Emblem corner icons representing platform capabilities** — public_images_synapseip_banner_short_idea_icon, public_images_synapseip_banner_short_analytics_icon, public_images_synapseip_banner_short_document_icon, public_images_synapseip_banner_short_search_icon [INFERRED 0.75]
- **SynapseIP capability icons around AI chip** — public_images_synapseip_banner_idea_icon, public_images_synapseip_banner_analytics_icon, public_images_synapseip_banner_patent_document_icon, public_images_synapseip_banner_search_icon [INFERRED 0.75]
- **Four icons orbiting central chip: ideas, analytics, documents, search** — public_images_synapseip_logo_lightbulb_icon, public_images_synapseip_logo_bar_chart_icon, public_images_synapseip_logo_document_scroll_icon, public_images_synapseip_logo_magnifier_icon [EXTRACTED 1.00]

## Communities (138 total, 35 thin omitted)

### Community 0 - "BigQuery ETL Core"
Cohesion: 0.07
Nodes (41): extract_independent_claims(), IndependentClaim, average_vectors(), BatchIngestResult, build_claims_inputs(), build_ta_input(), choose_assignee_names(), chunked() (+33 more)

### Community 1 - "Citation Metrics & Risk Radar"
Cohesion: 0.10
Nodes (46): export_risk_radar(), draw_label_value(), _ensure_space(), _wrap_lines(), get_dependency_matrix(), get_encroachment(), get_forward_impact(), get_risk_radar() (+38 more)

### Community 2 - "USPTO XML Application Parser"
Cohesion: 0.06
Nodes (27): _compose_pub_id(), create_connection(), extract_abstract(), extract_application_number(), extract_claims(), extract_pub_id(), extract_pub_id_without_kind(), extract_publication_doc_number() (+19 more)

### Community 3 - "USPTO XML Issued Patent Parser"
Cohesion: 0.07
Nodes (27): _compose_pub_id(), create_connection(), extract_abstract(), extract_application_number(), extract_claims(), extract_pub_id(), extract_pub_id_without_kind(), extract_publication_doc_number() (+19 more)

### Community 4 - "Overview Page UI"
Cohesion: 0.05
Nodes (55): abstractPreviewText(), ActiveSignalStatus, AssigneeSignals, buttonBaseStyle, Card(), CpcBarChart(), cpcDefinitionUrl(), CPCList() (+47 more)

### Community 5 - "Search API & Saved Queries"
Cohesion: 0.08
Nodes (31): create_saved_query(), DateRangeReponse, delete_saved_query(), ensure_app_user_record(), export_scope_analysis(), draw_wrapped_text(), _ensure_space(), favicon() (+23 more)

### Community 6 - "Citation Page UI"
Cohesion: 0.07
Nodes (51): AssigneeEncroachmentSummary, cardBaseStyle, CitationPage(), buildScopeFromState(), CitationScope, compareValues(), DependencyEdge, DependencyMatrixCard() (+43 more)

### Community 8 - "Independent Claim Embeddings"
Cohesion: 0.08
Nodes (16): average_vectors(), build_claims_inputs(), chunked(), clamp_text(), DbPoolManager, embed_texts(), ensure_embeddings_for_batch(), get_openai_client() (+8 more)

### Community 9 - "Overview API Metrics"
Cohesion: 0.09
Nodes (25): _build_filter_clause(), _clean_keywords(), _compute_momentum(), CpcBreakdownItem, CrowdingMetrics, DensityMetrics, _ensure_active_subscription_async(), _filter_semantic_pub_ids() (+17 more)

### Community 10 - "ETL Embedding Backfill"
Cohesion: 0.09
Nodes (18): average_vectors(), build_claims_inputs(), build_ta_input(), chunked(), clamp_text(), embed_texts(), ensure_embeddings_for_batch(), get_openai_client() (+10 more)

### Community 11 - "Alerts Runner"
Cohesion: 0.08
Nodes (18): _add_hyphens_to_date(), _as_str(), _build_search_sql(), _build_where_clauses(), _embed_semantic_query(), fetch_saved_queries(), _format_filters_for_email(), _from_header() (+10 more)

### Community 12 - "Assignee Name Backfill"
Cohesion: 0.09
Nodes (25): backfill_missing_assignees(), reconnect_db(), build_request_body(), connect_db(), create_session(), extract_assignee_name(), _extract_from_record(), fetch_assignee_name() (+17 more)

### Community 13 - "Deprecated ETL"
Cohesion: 0.09
Nodes (24): average_vectors(), build_claims_inputs(), build_ta_input(), chunked(), clamp_text(), _clean_claims(), content_hash(), embed_texts() (+16 more)

### Community 14 - "USPTO ODP ETL"
Cohesion: 0.10
Nodes (27): build_filters(), build_pagination(), build_range_filter(), build_sorting(), chunked(), compile_keyword_patterns(), content_hash(), _date_to_int() (+19 more)

### Community 15 - "API Endpoint Tests"
Cohesion: 0.17
Nodes (24): PatentHit, FakeAsyncConnection, make_subscription_cursor(), _cleanup_client(), _make_client(), test_create_saved_query(), test_create_saved_query_requires_email(), test_delete_saved_query() (+16 more)

### Community 16 - "Next.js API Proxy Routes"
Cohesion: 0.11
Nodes (17): POST(), POST(), POST(), POST(), POST(), DEFAULT_RETRYABLE_STATUS, fetchWithRetry(), FetchWithRetryOptions (+9 more)

### Community 17 - "Home Page UI"
Cohesion: 0.08
Nodes (31): metadata, Page(), buttonBaseStyle, Card(), dangerBtn, fmtDateCell(), fmtShortDate(), footerStyle (+23 more)

### Community 18 - "Alembic Migrations"
Cohesion: 0.06
Nodes (12): downgrade(), upgrade(), downgrade(), upgrade(), downgrade(), upgrade(), downgrade(), upgrade() (+4 more)

### Community 19 - "Assignee Canonicalization"
Cohesion: 0.10
Nodes (18): canonicalize_assignee(), insert_patent_assignees(), main(), PatentRow, PatentUpdate, query_patent_batch(), _remove_punct_and_collapse(), run() (+10 more)

### Community 20 - "Issued Patent Checker"
Cohesion: 0.14
Nodes (27): build_request_body(), _clean_name_list(), _collect_field_values(), connect_db(), create_session(), _date_to_int(), extract_assignee_name(), extract_inventor_names() (+19 more)

### Community 21 - "Payment API"
Cohesion: 0.10
Nodes (13): cancel_subscription(), create_checkout_session(), create_portal_session(), CreateCheckoutSessionRequest, CreateCheckoutSessionResponse, CustomerPortalResponse, get_or_create_stripe_customer(), get_pricing_plans() (+5 more)

### Community 22 - "Overview Signals"
Cohesion: 0.11
Nodes (19): pct_rank(), signal_bridge(), signal_crowd_out(), signal_emerging_gap(), signal_focus_shift(), SignalComputation, slope_conf(), test_signal_bridge_handles_asymmetric_growth() (+11 more)

### Community 23 - "DB Test Fixtures"
Cohesion: 0.09
Nodes (12): fake_user(), FakeAsyncTransaction, FakePool, test_get_settings_requires_database_url(), test_get_settings_returns_values(), ConnWithTransaction, reset_pool(), StubPool (+4 more)

### Community 24 - "Subscription Middleware"
Cohesion: 0.12
Nodes (8): get_current_user(), check_active_subscription(), get_subscription_info(), get_subscription_status_for_user(), require_active_subscription(), require_tier(), SubscriptionRequiredError, TestSubscriptionRequiredError

### Community 25 - "Package Metadata"
Cohesion: 0.07
Nodes (28): author, bugs, url, description, homepage, keywords, license, main (+20 more)

### Community 26 - "BQ Issued Patent Staging"
Cohesion: 0.09
Nodes (11): chunked(), extract_independent_claims(), get_application_numbers(), IndependentClaim, _is_grant_pub_id(), main(), parse_args(), PatentUpdateRecord (+3 more)

### Community 27 - "Repository Tests"
Cohesion: 0.13
Nodes (15): SearchFilters, FakeAsyncCursor, test_adaptive_filters_respects_jump_threshold(), test_cpc_dict_to_code_handles_segments(), test_export_rows_keyword_path(), test_export_rows_vector_path_limits_results(), test_export_rows_vector_sort_by_assignee(), test_scope_claim_knn_calibrates_and_preserves_distance_order() (+7 more)

### Community 28 - "Subscription Middleware Tests"
Cohesion: 0.10
Nodes (3): TestCheckActiveSubscription, TestGetSubscriptionInfo, TestRequireActiveSubscription

### Community 29 - "Patent Staging Updater"
Cohesion: 0.11
Nodes (8): chunked(), ensure_citation_columns(), get_application_numbers(), main(), parse_args(), PatentUpdateRecord, query_bigquery_batch(), update_patents_batch()

### Community 30 - "Sigma Overview Graph"
Cohesion: 0.12
Nodes (22): SigmaOverviewGraph, canonicalizeKeyword(), CLUSTER_TERM_STEM_STOPWORDS, CLUSTER_TERM_STOPWORDS, ClusterLegendEntry, colorForCluster(), escapeHtml(), formatGooglePatentId() (+14 more)

### Community 31 - "README, License & Stack"
Cohesion: 0.13
Nodes (23): Phaethon Order LLC Proprietary License, Commercial Service Notice, Evaluation License terms, Site verification token file (public), Google Search Console verification file, SynapseIP README, Auth0 authentication, Citation Analytics (+15 more)

### Community 32 - "Staged Patent Migration"
Cohesion: 0.13
Nodes (9): delete_all_staging(), delete_non_ai_entries(), get_staging_date_range(), invoke_etl_add_embeddings(), main(), migrate_patents_batch(), migrate_single_patent(), parse_args() (+1 more)

### Community 33 - "Billing UI"
Cohesion: 0.13
Nodes (19): actionButtonStyle, BillingContent(), BillingPage(), cardBaseStyle, errorCardStyle, footerStyle, pageWrapperStyle, PricePlan (+11 more)

### Community 34 - "Search Repository"
Cohesion: 0.19
Nodes (11): _adaptive_filters(), _assignee_sort_key(), _cpc_dict_to_code(), _dtint(), export_rows(), _filters_sql(), _pub_date_asc_sort_key(), _pub_date_desc_sort_key() (+3 more)

### Community 35 - "API Schemas Screenshot"
Cohesion: 0.10
Nodes (21): API Docs Schemas Panel (screenshot 2), AssigneeEncroachmentSummary, CreateCheckoutSessionRequest, CreateCheckoutSessionResponse, CrowdingMetrics, DensityMetrics, EncroachmentRequest, EncroachmentResponse (+13 more)

### Community 36 - "Citation Loader"
Cohesion: 0.16
Nodes (9): chunked(), CitationRecord, ImportStats, insert_citations_batch(), iter_citation_rows(), load_citations(), main(), parse_args() (+1 more)

### Community 37 - "TypeScript Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, incremental, isolatedModules, jsx (+12 more)

### Community 38 - "GlitchTip Frontend Errors"
Cohesion: 0.13
Nodes (8): GlitchtipExampleFrontendError, Page(), onRouterTransitionStart, onRequestError, register(), baseConfig, require, @sentry/nextjs

### Community 39 - "App Layout & Navigation"
Cohesion: 0.15
Nodes (13): appSans, metadata, RootLayout(), Providers(), GlitchtipInit(), buildAlertHref(), fmtDateCell(), NavBar() (+5 more)

### Community 40 - "Scope Analysis Page UI"
Cohesion: 0.14
Nodes (19): cardBaseStyle, footerStyle, formatPubDate(), formatSimilarity(), googlePatentsUrl(), GraphProps, inputStyle, pageSurfaceStyle (+11 more)

### Community 41 - "Stripe Config"
Cohesion: 0.13
Nodes (7): ensure_stripe_configured(), get_stripe_settings(), _load_stripe_settings(), _require_prefix(), _require_value(), reset_stripe_settings_cache(), StripeSettings

### Community 42 - "Citation CSV Processor"
Cohesion: 0.15
Nodes (9): create_request_body(), _find_first_string(), get_api_key(), main(), process_csv_file(), query_uspto_api(), _safe_str(), USPTOApiError (+1 more)

### Community 43 - "Citation CSV Upsert"
Cohesion: 0.14
Nodes (9): chunked(), CitationRow, ImportStats, iter_rows(), load_from_csv(), main(), parse_args(), positive_int() (+1 more)

### Community 44 - "Weekly ETL Workflow"
Cohesion: 0.13
Nodes (17): ETL weekly workflow, Canonical assignee normalizer step, scripts/big-query-etl/etl.py step, Issued patent checker step, public.issued_patent_staging, Google BigQuery, Canonical assignee name normalization, BigQuery ETL pipeline (etl.py) (+9 more)

### Community 45 - "Help Page"
Cohesion: 0.13
Nodes (16): actionRowStyle, cardBaseStyle, DetailItem(), FlowStep(), footerStyle, Footnote(), HelpIndexPage(), linkButtonStyle (+8 more)

### Community 46 - "Scope Calibrated Scoring"
Cohesion: 0.15
Nodes (10): calibrated_score(), risk_band(), HANDOFF: Scope Analysis search quality (2026-09-14), Issued patents only filter (hnsw.iterative_scan strict_order), Scope Analysis feature, Calibrated score clamp01(1 - distance/0.604), test_calibrated_score_anchors_on_identical_and_background(), test_calibrated_score_clamps_beyond_background() (+2 more)

### Community 47 - "Database Schema Doc"
Cohesion: 0.23
Nodes (19): Database Schema (PostgreSQL 17 on Neon), public.active_subscriptions, public.assignee_alias, public.canonical_assignee_name, public.citation_assignee_resolved, public.cited_patent_assignee, public.cited_patent_assignee_raw, public.cited_patent_assignee_raw_dedup (+11 more)

### Community 48 - "Stripe Subscription Webhooks"
Cohesion: 0.18
Nodes (8): get_or_create_stripe_customer(), handle_checkout_session_completed(), handle_invoice_payment_failed(), handle_subscription_created(), handle_subscription_deleted(), handle_subscription_updated(), _lookup_subscription_db_id(), upsert_subscription()

### Community 49 - "Overview Graph Endpoint"
Cohesion: 0.18
Nodes (10): _ensure_active_subscription(), get_overview_graph(), get_pool(), GraphRequest, neighbor_momentum(), _persist_background(), _persist_sync(), pick_model() (+2 more)

### Community 50 - "Search Trends Help Page"
Cohesion: 0.17
Nodes (12): ActionDescription(), AlertAction(), cardBaseStyle, footerStyle, InputDescription(), linkButtonStyle, pageWrapperStyle, ResultField() (+4 more)

### Community 51 - "Assignee Signal Builder"
Cohesion: 0.14
Nodes (7): AssigneeSignals, build_group_signals(), _payload(), _compute_bridge_inputs(), compute_overview_metrics(), _format_label_terms(), SignalPayload

### Community 52 - "Embedding KNN & Density"
Cohesion: 0.16
Nodes (12): build_knn(), EmbeddingMeta, _from_int_date(), load_embeddings(), _ingest_rows(), _run_query(), local_density(), _to_int_date() (+4 more)

### Community 53 - "Applications-to-Patents Updater"
Cohesion: 0.18
Nodes (7): apply_updates_and_inserts(), chunked(), fetch_patent_records(), main(), parse_args(), refresh_embeddings(), summarize_staging()

### Community 54 - "Auth0 Integration"
Cohesion: 0.19
Nodes (8): lifespan(), Auth0Settings, ensure_auth0_configured(), get_auth0_settings(), _load_auth0_settings(), _require_https(), _require_value(), UnauthorizedException

### Community 55 - "Citation Help Page"
Cohesion: 0.19
Nodes (12): cardBaseStyle, CitationHelpPage(), DetailList(), footerStyle, InputDescription(), InterpretationBand(), linkButtonStyle, pageWrapperStyle (+4 more)

### Community 56 - "Overview Node Data"
Cohesion: 0.14
Nodes (8): _build_node_data(), _compute_cluster_term_map(), _is_allowed_cluster_term(), NodeDatum, _normalize_assignee(), _parse_date_str(), _tokenize_cluster_terms(), _window_bounds()

### Community 57 - "BigQuery Assignee Backfill"
Cohesion: 0.27
Nodes (10): backfill_assignees(), build_bq_client(), chunked(), fetch_assignee_names(), fetch_missing_pub_ids(), latest_publication_date(), main(), parse_args() (+2 more)

### Community 58 - "DB Pool & Settings"
Cohesion: 0.20
Nodes (6): get_settings(), Settings, get_conn(), init_pool(), reset_pool(), _reset_pool()

### Community 59 - "Auth Tests"
Cohesion: 0.24
Nodes (7): auth_env(), DummyJwkClient, DummySigningKey, test_get_current_user_expired(), _raise(), test_get_current_user_missing_claim(), test_get_current_user_success()

### Community 60 - "Overview Help Page"
Cohesion: 0.22
Nodes (11): BestPractice(), cardBaseStyle, footerStyle, InputDescription(), LayoutSection(), linkButtonStyle, MetricTile(), OverviewHelpPage() (+3 more)

### Community 61 - "Stripe Event Backfill"
Cohesion: 0.18
Nodes (3): _backfill_subscription_events(), _compute_period_end(), _to_uuid()

### Community 62 - "Citations CSV Generator"
Cohesion: 0.17
Nodes (4): generate_csv(), get_patent_citations(), main(), parse_args()

### Community 64 - "Overview Signals Screenshot"
Cohesion: 0.20
Nodes (8): Overview UI screenshot 2: Assignee Signals, Assignee Signals panel, Aurora Operations assignee card, Patent cluster network graph with cluster legend, GM Cruise Holdings assignee card, NVIDIA assignee card, Unknown assignee card, Waymo assignee card (Strong crowd-out risk)

### Community 65 - "Frontend Dependencies"
Cohesion: 0.17
Nodes (12): dependencies, @auth0/auth0-react, graphology, graphology-layout, graphology-layout-forceatlas2, jspdf, next, react (+4 more)

### Community 66 - "API Error & Delete Routes"
Cohesion: 0.16
Nodes (3): dynamic, GET(), GlitchtipExampleAPIError

### Community 67 - "Embedding Tests"
Cohesion: 0.24
Nodes (5): embed(), DummyEmbeddingResponse, DummyEmbeddingsEndpoint, DummyOpenAIClient, test_embed_uses_openai_client()

### Community 68 - "Stripe Event Logging"
Cohesion: 0.24
Nodes (5): _extract_stripe_subscription_id(), _json_default(), log_event(), _normalize_event_object(), _resolve_subscription_id()

### Community 69 - "Cited Refs Assignee Backfill"
Cohesion: 0.18
Nodes (5): create_request_body(), get_api_key(), main(), process_csv_file(), query_uspto_api()

### Community 70 - "Legal Docs Index"
Cohesion: 0.24
Nodes (8): cardBaseStyle, DetailItem(), footerStyle, InfoSection(), LegalIndexPage(), linkButtonStyle, pageWrapperStyle, surfaceStyle

### Community 71 - "Scope Analysis Help Page"
Cohesion: 0.24
Nodes (8): cardBaseStyle, DetailItem(), footerStyle, linkButtonStyle, pageWrapperStyle, ScopeAnalysisHelpPage(), surfaceStyle, WorkflowStep()

### Community 72 - "Observability & Logging"
Cohesion: 0.22
Nodes (3): _glitchtip_env(), init_glitchtip_if_configured(), get_logger()

### Community 73 - "API Docs Screenshot"
Cohesion: 0.24
Nodes (10): Authorize (bearer auth, lock icons on protected endpoints), citation endpoint group (impact, dependency-matrix, risk-radar, risk-radar/export, encroachment), default endpoint group (search, scope_analysis, saved-queries, trend, patent, export, webhooks), overview endpoint group (GET /overview/overview, POST /overview/graph), payment endpoint group (checkout, portal, subscription status, pricing plans, cancel, reactivate), /saved-queries CRUD endpoints, POST /scope_analysis and /scope_analysis/export, POST /search (+2 more)

### Community 74 - "Citation UI Screenshot"
Cohesion: 0.27
Nodes (10): Citation Tracker UI Screenshot, Adobe (source assignee), Patent & Publication Citation Tracker page, Cross-Assignee Dependency widget, Citation dependency heatmap row (Adobe to competitors), Forward-Citation Impact widget, Influence timeline chart, SynapseIP top navigation bar (+2 more)

### Community 75 - "Overview UI Screenshot"
Cohesion: 0.20
Nodes (9): SynapseIP IP Overview UI Screenshot, CPC Distribution Bar Chart, Density and Distribution Analysis, Results Table with Export PDF, Scope Metrics Cards (Saturation, Activity Rate, Momentum, Top CPCs), Search Filters (Focus Keywords, CPC, Date Range, Semantic Neighbors, Group by Assignee), Semantic Neighbors (exact vs semantic matches), Timeline Chart (monthly activity, 24 month window) (+1 more)

### Community 76 - "Stripe Invoice Period Handling"
Cohesion: 0.25
Nodes (5): _ensure_subscription_period_bounds(), _prefer_latest(), _extract_invoice_period_bounds(), handle_invoice_payment_succeeded(), _to_utc_datetime()

### Community 77 - "Scope UI Screenshot"
Cohesion: 0.31
Nodes (8): Scope Analysis UI Screenshot, Claim proximity breakdown (impact summary tiles), Closest patent claims table (sortable, Export PDF), SynapseIP top navigation bar, Scope Analysis page (Preliminary FTO / Infringement Radar), Similarity map (radial graph with High Risk badge), Subject matter to search input (textarea, # of claim comparisons, Run scope analysis), Top match US-11776129-B2 claim 1 (Qualcomm, 98.8%)

### Community 78 - "Patent Data JSON Schema"
Cohesion: 0.22
Nodes (8): type, items, type, properties, count, patentFileWrapperDataBag, $schema, type

### Community 79 - "DPA Page"
Cohesion: 0.32
Nodes (7): cardBaseStyle, DataProcessingAgreementPage(), footerStyle, pageWrapperStyle, Section(), Subsection(), surfaceStyle

### Community 80 - "Privacy Page"
Cohesion: 0.32
Nodes (7): cardBaseStyle, footerStyle, pageWrapperStyle, PrivacyPolicyPage(), Section(), Subsection(), surfaceStyle

### Community 81 - "Terms of Service Page"
Cohesion: 0.32
Nodes (7): cardBaseStyle, footerStyle, pageWrapperStyle, Section(), Subsection(), surfaceStyle, TermsOfServicePage()

### Community 82 - "Encroachment UI Screenshot"
Cohesion: 0.32
Nodes (7): Adobe portfolio (scoped patents, e.g. US-2024135611-A1, US-12175619-B2), Assignee Encroachment panel, Competitor assignees (Samsung Electronics, IBM, NVIDIA, Qualcomm, Intel), Encroachment score table (assignee, total citing patents, score bar, velocity), Encroachment timeline line chart (top 10 assignees by citing patents, quarterly buckets), Export PDF button, Risk Radar panel (forward exposure + backward fragility table)

### Community 83 - "Search UI Screenshot"
Cohesion: 0.32
Nodes (7): SynapseIP Search & Trends UI Screenshot, Results List (57,394 total, sortable, export CSV/PDF), Save Alert Action, Search Filter Panel (Semantic Query, Keywords, Assignee, CPC, date range), Semantic Query (natural language technology description), Top Navigation Bar (Search & Trends, IP Overview, Citation Tracker, Scope Analysis, Help), Trend Line Chart (patent counts grouped by month)

### Community 85 - "Frontend Dev Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @tailwindcss/cli, @types/react, @types/react-dom, typescript

### Community 86 - "Patent Claims Backfill"
Cohesion: 0.29
Nodes (6): backfill_patent_claims(), main(), _normalize(), parse_args(), process_batch(), Stats

### Community 87 - "Alerts Workflow & Tables"
Cohesion: 0.38
Nodes (7): SynapseIP Alerts workflow, alerts_runner.py job, public.alert_event, public.app_user, public.saved_query, Alerts runner (alerts_runner.py), Mailgun notifications

### Community 88 - "Embeddings & HNSW Indexes"
Cohesion: 0.33
Nodes (7): Embedding backfill step, public.patent_claim_embeddings, public.patent_embeddings, pgvector HNSW cosine indexes, HNSW recall risk (ef_search 40), Embedding backfill utility, Migrate staged patents

### Community 89 - "Search PDF Export"
Cohesion: 0.43
Nodes (6): export(), draw_inline_meta(), draw_label_value(), _ensure_space(), gen(), _int_date()

### Community 91 - "Webhook Idempotency"
Cohesion: 0.29
Nodes (3): is_event_processed(), process_webhook_event(), WebhookError

### Community 92 - "Banner Logo Image"
Cohesion: 0.33
Nodes (7): Bar Chart Icon (Analytics), Circuit Chip Emblem, Lightbulb Icon (Ideas/Innovation), Patent Document Scroll Icon, Magnifying Glass Icon (Search), SynapseIP Banner Logo, SynapseIP Wordmark (slate blue embossed)

### Community 93 - "Short Banner Logo Image"
Cohesion: 0.33
Nodes (7): SynapseIP Banner Logo (short), Bar chart icon (analytics), SynapseIP wordmark, Circuit-chip emblem in circle, Document scroll icon (patent documents), Lightbulb icon (ideas/innovation), Magnifier icon (search)

### Community 94 - "Middleware Test Mocks"
Cohesion: 0.29
Nodes (3): mock_conn(), mock_cursor(), mock_user()

### Community 96 - "Assignee Matching"
Cohesion: 0.40
Nodes (5): _assignee_search_patterns(), _canonicalize_assignee_for_lookup(), _match_canonical_assignees(), _score(), _remove_punct_and_collapse()

### Community 97 - "Overview Date Utilities"
Cohesion: 0.33
Nodes (6): deriveOverviewDateRange(), formatIsoDateUtc(), monthFloorUtc(), pad2(), parseIsoDateUtc(), shiftMonthsUtc()

### Community 98 - "Timeline Sparkline"
Cohesion: 0.40
Nodes (6): formatTimelineFullLabel(), formatTimelineMonthLabel(), parseTimelineMonth(), shiftMonth(), sumRecentMonths(), TimelineSparkline()

### Community 99 - "Claims Staging & Loaders"
Cohesion: 0.33
Nodes (6): public.patent_claim, public.patent_claim_staging, public.patent_staging, Stale claims recurrence problem, USPTO PEDS API loader, USPTO bulk XML parser

### Community 100 - "Apple Touch Icon"
Cohesion: 0.40
Nodes (6): SynapseIP Apple Touch Icon (circuit-chip logo), Bar chart icon (analytics), Central microchip with circuit traces, Document icon (patent documents), Lightbulb icon (ideas/innovation), Magnifying glass icon (search/analysis)

### Community 101 - "SynapseIP Logo Image"
Cohesion: 0.40
Nodes (6): Bar chart icon (analytics/trends), Central microchip with circuit traces (AI/neural processing motif), Document scroll icon (patent documents/claims), Lightbulb icon (ideas/invention), Magnifying glass icon (search/analysis), SynapseIP Logo (circuit-chip emblem in circle, navy blue)

### Community 103 - "Cluster Labeling"
Cohesion: 0.50
Nodes (4): cluster_labels(), find(), union(), test_cluster_labels_fallback()

### Community 104 - "Graphology Type Decls"
Cohesion: 0.40
Nodes (4): graphology, graphology-layout, graphology-layout-forceatlas2, sigma

### Community 105 - "Forward Impact Schemas"
Cohesion: 0.50
Nodes (4): ForwardImpactPoint, ForwardImpactRequest, ForwardImpactResponse, PatentImpactSummary

### Community 106 - "Graph Schemas"
Cohesion: 0.50
Nodes (4): GraphContext, GraphEdge, GraphNode, GraphRequest

### Community 109 - "Dependency Matrix Schemas"
Cohesion: 0.67
Nodes (3): DependencyEdge, DependencyMatrixRequest, DependencyMatrixResponse

### Community 111 - "PatentScout Logo Image"
Cohesion: 0.67
Nodes (3): Certified document icon (badge with checkmark), Patent Scout (brand name), Patent Scout Logo

## Knowledge Gaps
- **334 isolated node(s):** `FetchWithRetryOptions`, `DEFAULT_RETRYABLE_STATUS`, `dynamic`, `SubscriptionInfo`, `PricePlan` (+329 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 904 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Billing UI` to `Overview Page UI`, `Legal Docs Index`, `Citation Page UI`, `GlitchTip Frontend Errors`, `Scope Analysis Help Page`, `Scope Analysis Page UI`, `App Layout & Navigation`, `Help Page`, `DPA Page`, `Privacy Page`, `Terms of Service Page`, `Search Trends Help Page`, `Home Page UI`, `Citation Help Page`, `Package Metadata`, `Overview Help Page`, `Sigma Overview Graph`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `setup_logger()` connect `Shared Config & Stdlib Imports` to `BigQuery ETL Core`, `USPTO XML Application Parser`, `USPTO XML Issued Patent Parser`, `Citation Loader`, `Observability & Logging`, `Independent Claim Embeddings`, `ETL Embedding Backfill`, `Assignee Name Backfill`, `Deprecated ETL`, `USPTO ODP ETL`, `Assignee Canonicalization`, `Alembic Env`, `Issued Patent Checker`, `BigQuery Assignee Backfill`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `SynapseIP README` connect `README, License & Stack` to `Claims Staging & Loaders`, `Weekly ETL Workflow`, `Database Schema Doc`, `Alerts Workflow & Tables`, `Embeddings & HNSW Indexes`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `FakeAsyncConnection` (e.g. with `_make_client()` and `StubPool`) actually correct?**
  _`FakeAsyncConnection` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `FetchWithRetryOptions`, `DEFAULT_RETRYABLE_STATUS`, `dynamic` to the rest of the system?**
  _334 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BigQuery ETL Core` be split into smaller, more focused modules?**
  _Cohesion score 0.07039337474120083 - nodes in this community are weakly interconnected._
- **Should `Citation Metrics & Risk Radar` be split into smaller, more focused modules?**
  _Cohesion score 0.09567307692307692 - nodes in this community are weakly interconnected._