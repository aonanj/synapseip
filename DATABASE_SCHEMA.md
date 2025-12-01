# Database Schema

This document outlines the database schema for the project. The database is a **PostgreSQL 17** instance hosted on [**Neon**](https://neon.tech/).

## TABLE OF CONTENTS

### [Main Tables](#main-tables-1)

* [public.patent](#publicpatent)
* [public.patent\_embeddings](#publicpatent_embeddings)
* [public.patent\_citation](#publicpatent_citation)
* [public.patent\_claim](#publicpatent_claim)
* [public.patent\_claim\_embeddings](#publicpatent_claim_embeddings)
* [public.user\_overview\_analysis](#publicuser_overview_analysis)
* [public.knn\_edge](#publicknn_edge)
* [public.alert\_event](#publicalert_event)
* [public.app\_user](#publicapp_user)
* [public.patent\_assignee](#publicpatent_assignee)
* [public.assignee\_alias](#publicassignee_alias)
* [public.canonical\_assignee\_name](#publiccanonical_assignee_name)
* [public.cited\_patent\_assignee](#publiccited_patent_assignee)
* [public.saved\_query](#publicsaved_query)
* [public.stripe\_customer](#publicstripe_customer)
* [public.subscription](#publicsubscription)
* [public.subscription\_event](#publicsubscription_event)
* [public.price\_plan](#publicprice_plan)

### [Staging & Logging Tables](#staging--logging-tables-1)

* [public.alembic\_version](#publicalembic_version)
* [public.patent\_staging](#publicpatent_staging)
* [public.patent\_claim\_staging](#publicpatent_claim_staging)
* [public.issued\_patent\_staging](#publicissued_patent_staging)
* [public.cited\_patent\_assignee\_raw](#publiccited_patent_assignee_raw)
* [public.cited\_patent\_assignee\_raw\_dedup](#publiccited_patent_assignee_raw_dedup)
* [public.ingest\_log](#publicingest_log)

### [Views](#views-1)

* [public.active\_subscriptions](#publicactive_subscriptions)
* [public.citation\_assignee\_resolved](#publiccitation_assignee_resolved)

---

## MAIN TABLES

### public.patent

Stores the core patent data. Entries in this table have at least one AI/ML-related CPC code and explicitly refer to AI/ML-related subject matter in the title, claims, and/or abstract. 

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub_id` | `text` | not null | |
| `family_id` | `text` | true | |
| `kind_code` | `text` | true | |
| `title` | `text` | not null | |
| `abstract` | `text` | true | |
| `claims_text` | `text` | true | |
| `assignee_name` | `text` | true | |
| `inventors` | `jsonb` | true | |
| `cpc` | `jsonb` | true | |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |
| `application_number` | `text` | true | |
| `priority_date` | `integer` | true | |
| `filing_date` | `integer` | true | |
| `pub_date` | `integer` | not null | |
| `canonical_assignee_name_id` | `uuid` | true | |
| `assignee_alias_id` | `uuid` | true | |


#### Indexes

* `patent_pkey` PRIMARY KEY, btree `(pub_id)`
* `patent_abstract_trgm_idx` gin `(abstract gin_trgm_ops)`
* `patent_application_number_key` UNIQUE CONSTRAINT, btree `(application_number)`
* `patent_assignee_idx` btree `(assignee name)`
* `patent_claims_idx` gin `(to_tsvector('english'::regconfig, claims_text))`
* `patent_cpc_jsonb_idx` gin `(cpc jsonb_path_ops)`
* `patent_search_expr_gin` gin `(((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(abstract, ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(claims_text, ''::text)), 'C'::"char")))`
* `patent_title_trgm_idx` gin `(title gin_trgm_ops)`
* `patent_tsv_idx` gin `(to_tsvector('english'::regconfig, (COALESCE(title, ''::text) || ' '::text) || COALESCE(abstract, ''::text)))`

#### Referenced By

* TABLE `patent_claim` CONSTRAINT `fk_patent` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE
* TABLE `patent_assignee` CONSTRAINT `patent_assignee_pub_id_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE
* TABLE `patent_citation` CONSTRAINT `patent_citation_pub_id_patent_pub_id_fkey` FOREIGN KEY `(citing_pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE
* TABLE `patent_embeddings` CONSTRAINT `patent_embeddings_pub_id_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE
* TABLE `user_overview_analysis` CONSTRAINT `user_overview_analysis_patent_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE

#### Triggers

* `trg_patent_updated_at` BEFORE UPDATE ON `patent` FOR EACH ROW EXECUTE FUNCTION `set_updated_at()`

---

### public.patent\_embeddings

Stores vector embeddings for patent data. `model` indicates which field(s) in the `patent` table are used to generate each embedding: `|ta` suffix indicates an embedding generated using `patent.title` and `patent.abstract`; `|c` suffix indicates an embedding generated using `patent.claim_text`.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `integer` | not null | `generated always as identity` |
| `pub_id` | `text` | not null | |
| `model` | `text` | not null | |
| `dim` | `integer` | not null | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `embedding` | `vector(1536)` | true | |


#### Indexes

* `patent_embeddings_pkey` PRIMARY KEY, btree `(id)`
* `patent_embeddings_hnsw_idx_claims` hnsw `(embedding vector_cosine_ops)` WHERE model = `'text-embedding-3-small|claims'::text`
* `patent_embeddings_hnsw_idx_ta` hnsw `(embedding vector_cosine_ops)` WHERE model = `'text-embedding-3-small|ta'::text`
* `patent_embeddings_model_idx` UNIQUE, btree `(model, pub_id)`

#### Check Constraints

* `patent_embeddings_dim_check` CHECK `(dim > 0)`

#### Foreign Key Constraints

* `patent_embeddings_pub_id_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE

---

### public.patent\_citation

Links patents in the `patent` table to the patents and publications they cite via `application_number`.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `bigint` | not null | `nextval('patent_citation_id_seq'::regclass)` |
| `citing_pub_id` | `text` | not null | |
| `cited_application number` | `text` | true | |
| `cited_pub_id` | `text` | true | |
| `cite_type` | `text` | true | |
| `cited_filing date` | `integer` | true | |
| `cited_priority date` | `integer` | true | |
| `relation_source` | `text` | not null | `'bigquery'::text` |
| `created_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `patent_citation_pkey` PRIMARY KEY, btree `(id)`
* `patent_citation_cited_application_number_idx` btree `(cited_application_number)`
* `patent_citation_citing_pub_id_idx` btree `(citing_pub_id)`

#### Foreign Key Constraints

* `patent_citation_pub_id_patent_pub_id_fkey` FOREIGN KEY `(citing_pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE

---

### public.patent\_claim

Stores independent claims of patents in the `patent` table for generating claim-specific embeddings.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `get_random_uuid()` |
| `pub_id` | `text` | not null | |
| `claim_number` | `integer` | not null | |
| `is_independent` | `boolean` | not null | `false` |
| `claim_text` | `text` | true | |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `patent_claim_pkey` PRIMARY KEY, btree `(id)`
* `idx_patent_claim_pub_id` btree `(pub_id)`
* `uq_patent_claim` UNIQUE CONSTRAINT, btree `(pub_id, claim_number)`

#### Foreign Key Constraints

* `fk_patent` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE

#### Referenced By

* TABLE `patent_claim_embeddings` CONSTRAINT `embeddings_pub_id_claim_no_patent_claim_fkey` FOREIGN KEY `(pub_id, claim_number)` REFERENCES `patent_claim(pub_id, claim_number)` ON UPDATE CASCADE ON DELETE CASCADE

---

### public.patent\_claim\_embeddings

Stores embeddings generated for individual independent claims of patents in the `patent_claim` table. 

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `bigint` | not null | `generated always as_identity` |
| `pub_id` | `text` | not null | |
| `claim_number` | `integer` | not null | |
| `dim` | `integer` | not null | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `embedding` | `vector(1536)` | true | |


#### Indexes

* `patent_claim_embeddings_pkey` PRIMARY KEY, btree `(id)`
* `idx_patent_claim_embeddings_pub_id` btree `(pub_id, claim_number)`
* `patent_claim_embeddings_hnsw_idx_claim_model` hnsw `(embedding vector_cosine_ops)`
* `uq_patent_claim_number` UNIQUE CONSTRAINT, btree `(pub_id, claim_number)`

#### Foreign Key Constraints

* `embeddings_pub_id_claim_no_patent_claim_fkey` FOREIGN KEY `(pub_id, claim_number)` REFERENCES `patent_claim(pub_id, claim_number)` ON UPDATE CASCADE ON DELETE CASCADE

---

### public.user\_overview\_analysis

Stores analysis results, like clustering and scoring, for user-specific query runs on the frontend Overview Analysis page.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `user_id` | `text` | not null | |
| `pub_id` | `text` | not null | |
| `model` | `text` | not null | |
| `cluster_id` | `integer` | true | |
| `local_density` | `real` | true | |
| `overview_score` | `real` | true | |
| `created_at` | `timestamp with time zone` | true | `now()` |
| `updated_at` | `timestamp with time zone` | true | `now()` |


#### Indexes

* `user_overview_analysis_pkey` PRIMARY KEY, btree `(user_id, pub_id, model)`
* `user_cluster_stats_idx` btree `(user_id, cluster_id, model)` WHERE `cluster_id IS NOT NULL`
* `user_overview_analysis_cluster_id_idx` btree `(cluster_id)` WHERE `cluster_id IS NOT NULL`
* `user_overview_analysis_model_idx` btree `(model)`
* `user_overview_analysis_pub_id_idx` btree `(pub_id)`
* `user_overview_analysis_user_id_idx` btree `(user_id)`

#### Foreign Key Constraints

* `user_overview_analysis_patent_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE

---

### public.knn\_edge

Represents edges in a user-specific K-Nearest Neighbors graph for similarity analysis.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `src` | `text` | not null | |
| `dst` | `text` | not null | |
| `w` | `real` | true | |
| `user_id` | `text` | not null | |


#### Indexes

* `knn_edge_pkey` PRIMARY KEY, btree `(user_id, src, dst)`
* `knn_edge_user_id_idx` btree `(user_id)`

---

### public.alert\_event

Stores events generated by alerts, which are tied to saved queries.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `saved_query_id` | `uuid` | not null | |
| `created_at` | `timestamp with time zone` | not null | |
| `results_sample` | `jsonb` | not null | |
| `count` | `integer` | not null | |


#### Indexes

* `alert_event_pkey` PRIMARY KEY, btree `(id)`
* `alert_event_saved_query_idx` btree `(saved query_id, created_at DESC)`

#### Foreign Key Constraints

* `alert event saved query_id fkey` FOREIGN KEY `(saved query_id)` REFERENCES `saved_query(id)` ON DELETE CASCADE

---

### public.app\_user

Stores user account information.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | not null | |
| `email` | `citext` | true | |
| `display_name` | `text` | true | |
| `created_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `app_user_pkey` PRIMARY KEY, btree `(id)`
* `app_user_email_key` UNIQUE CONSTRAINT, btree `(email)`

#### Referenced By

* TABLE `saved_query` CONSTRAINT `saved_query_app_user_fkey` FOREIGN KEY `(owner_id)` REFERENCES `app_user(id)` ON DELETE CASCADE

---

### public.patent\_assignee

Links `patent.pub_id` to assignee alias and canonical assignee names via `alias_id` and `canonical_id`, respectively.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub_id` | `text` | not null | |
| `alias_id` | `uuid` | not null | |
| `canonical_id` | `uuid` | not null | |
| `position` | `smallint` | not null | |

#### Indexes

* `patent_assignee_pkey` PRIMARY KEY, btree `(pub_id, alias_id)`
* `patent_assignee_canonical_idx` btree `(canonical_id)`

#### Foreign Key Constraints

* `patent_assignee_alias_id_fkey` FOREIGN KEY `(alias_id)` REFERENCES `assignee_alias(id)` ON UPDATE CASCADE
* `patent_assignee_canonical_id_fkey` FOREIGN KEY `(canonical_id)` REFERENCES `canonical_assignee_name(id)` ON UPDATE CASCADE
* `patent_assignee_pub_id_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE

---

### public.assignee\_alias

Links different assignee name aliases to a single canonical ID and canonical assignee name.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `canonical_id` | `uuid` | not null | |
| `assignee_alias` | `text` | not null | |
| `source` | `text` | true | |
| `created_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `assignee_alias_pkey` PRIMARY KEY, btree `(id)`
* `assignee_alias_assignee_alias_key` UNIQUE CONSTRAINT, btree `(assignee_alias)`
* `assignee_id_canonical_id_uq` UNIQUE CONSTRAINT, btree `(id, canonical_id)`
* `canonical_id_assignee_alias_uq` UNIQUE CONSTRAINT, btree `(canonical_id, assignee_alias)`

#### Foreign Key Constraints

* `assignee_alias_canonical_id_fkey` FOREIGN KEY `(canonical_id)` REFERENCES `canonical_assignee_name(id)` ON UPDATE CASCADE ON DELETE CASCADE

#### Referenced By

* TABLE `cited_patent_assignee` CONSTRAINT `cited_patent_assignee_assignee_alias_id_fkey` FOREIGN KEY `(assignee_alias_id)` REFERENCES `assignee_alias(id)`
* TABLE `patent_assignee` CONSTRAINT `patent assignee alias_id fkey` FOREIGN KEY `(alias_id)` REFERENCES `assignee_alias(id)` ON UPDATE CASCADE

---

### public.canonical\_assignee\_name

Stores the single, canonical name for an assignee.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `canonical_assignee_name` | `text` | not null | |
| `created_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `canonical_assignee_name_pkey` PRIMARY KEY, btree `(id)`
* `uq_canonical_assignee_name` UNIQUE CONSTRAINT, btree `(canonical_assignee_name)`

#### Referenced By

* TABLE `assignee_alias` CONSTRAINT `assignee_alias_canonical_id_fkey` FOREIGN KEY `(canonical_id)` REFERENCES `canonical_assignee_name(id)` ON UPDATE CASCADE ON DELETE CASCADE
* TABLE `cited_patent_assignee` CONSTRAINT `cited_patent_assignee_canonical_assignee_name_id_fkey` FOREIGN KEY `(canonical_assignee_name_id)` REFERENCES `canonical_assignee_name(id)`
* TABLE `patent_assignee` CONSTRAINT `patent_assignee_canonical_id_fkey` FOREIGN KEY `(canonical_id)` REFERENCES `canonical_assignee_name(id)` ON UPDATE CASCADE

---

### public.cited\_patent\_assignee

Stores information mapping assignees corresponding to entries in `patent_citation.cited_pub_id`/`patent_citation.cited_application_number` to a canonical assignee name in `canonical_assignee_name`. Does not store mappings for `patent_citation.cited_pub_id`/`patent_citation.cited_application_number` that match on `patent.application_number` (those mappings are available using the `patent` table).

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `pub_id` | `text` | true | |
| `application_number` | `text` | true | |
| `canonical_assignee_name_id` | `uuid` | true | |
| `assignee_alias_id` | `uuid` | true | |
| `source` | `text` | not null | `'uspto_odp'::text` |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `cited_patent_assignee_pkey` PRIMARY KEY, btree `(id)`
* `cited_patent_assignee_application_number_key` UNIQUE CONSTRAINT, btree `(application_number)`
* `cited_patent_assignee_pub_id_key` UNIQUE CONSTRAINT, btree `(pub_id)`

#### Foreign-key constraints:

* `cited_patent_assignee_assignee_alias_id_fkey` FOREIGN KEY `(assignee_alias_id)` REFERENCES `assignee_alias(id)`
* `cited_patent_assignee_canonical_assignee_name_id_fkey` FOREIGN KEY `(canonical_assignee_name_id)` REFERENCES `canonical_assignee_name(id)`

---

### public.saved\_query

Stores user-defined queries, which can be run on a schedule to generate alerts.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `owner_id` | `text` | not null | |
| `name` | `text` | not null | |
| `filters` | `jsonb` | not null | |
| `semantic_query` | `text` | true | |
| `schedule_cron` | `text` | true | |
| `is_active` | `boolean` | not null | `true` |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | |


#### Indexes

* `saved_query_pkey` PRIMARY KEY, btree `(id)`
* `uq_saved_query_owner_name` UNIQUE CONSTRAINT, btree `(owner_id, name)`

#### Foreign Key Constraints

* `saved_query_app_user_fkey` FOREIGN KEY `(owner_id)` REFERENCES `app_user(id)` ON DELETE CASCADE

#### Referenced By

* TABLE `alert_event` CONSTRAINT `alert_event_saved_query_id_fkey` FOREIGN KEY `(saved_query_id)` REFERENCES `saved_query(id)` ON DELETE CASCADE

#### Triggers

* `trg_saved_query_updated_at` BEFORE UPDATE ON `saved_query` FOR EACH ROW EXECUTE FUNCTION `set_updated_at()`

---

### public.stripe\_customer

Maps a user ID to a Stripe Customer ID for billing and subscription verification.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `user_id` | `text` | not null | |
| `stripe_customer_id` | `text` | not null | |
| `email` | `text` | not null | |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `stripe_customer_pkey` PRIMARY KEY, btree `(user_id)`
* `stripe_customer_email_idx` btree `(email)`
* `stripe_customer_stripe_customer_id_key` UNIQUE CONSTRAINT, btree `(stripe_customer_id)`
* `stripe_customer_stripe_id_idx` btree `(stripe_customer_id)`

#### Referenced By

* TABLE `subscription` CONSTRAINT `subscription_stripe_customer_id_fkey` FOREIGN KEY `(stripe_customer_id)` REFERENCES `stripe_customer(stripe_customer_id)` ON DELETE CASCADE
* TABLE `subscription` CONSTRAINT `subscription_user_id_fkey` FOREIGN KEY `(user_id)` REFERENCES `stripe_customer(user_id)` ON DELETE CASCADE

---

### public.subscription

Stores subscription details for users, linking them to Stripe plans and customers.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `user_id` | `text` | not null | |
| `stripe_subscription_id` | `text` | not null | |
| `stripe_customer_id` | `text` | not null | |
| `stripe_price_id` | `text` | not null | |
| `tier` | `subscription_tier` | not null | |
| `status` | `subscription_status` | not null | |
| `current_period_start` | `timestamp with time zone` | not null | |
| `current_period_end` | `timestamp with time zone` | not null | |
| `cancel_at_period_end` | `boolean` | not null | `false` |
| `canceled_at` | `timestamp with time zone` | true | |
| `tier_started_at` | `timestamp with time zone` | not null | `now()` |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `subscription_pkey` PRIMARY KEY, btree `(id)`
* `subscription_period_end_idx` btree `(current_period_end)`
* `subscription_status_idx` btree `(status)`
* `subscription_stripe_subscription_id_idx` btree `(stripe_subscription_id)`
* `subscription_stripe_subscription_id_key` UNIQUE CONSTRAINT, btree `(stripe_subscription_id)`
* `subscription_tier_idx` btree `(tier)`
* `subscription_user_id_idx` btree `(user_id)`
* `subscription_user_status_idx` btree `(user_id, status)`

#### Foreign Key Constraints

* `subscription_stripe_customer_id_fkey` FOREIGN KEY `(stripe_customer_id)` REFERENCES `stripe_customer(stripe_customer_id)` ON DELETE CASCADE
* `subscription_stripe_price_id_fkey` FOREIGN KEY `(stripe_price_id)` REFERENCES `price_plan(stripe_price_id)`
* `subscription_user_id_fkey` FOREIGN KEY `(user_id)` REFERENCES `stripe_customer(user_id)` ON DELETE CASCADE

#### Referenced By

* TABLE `subscription_event` CONSTRAINT `subscription_event_subscription_id_fkey` FOREIGN KEY `(subscription_id)` REFERENCES `subscription(id)` ON DELETE SET NULL

---

### public.subscription\_event

Logs incoming webhook events from Stripe related to subscriptions.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `stripe_event_id` | `text` | not null | |
| `subscription_id` | `uuid` | true | |
| `event_type` | `text` | not null | |
| `event_data` | `jsonb` | not null | |
| `processed_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `subscription_event_pkey` PRIMARY KEY, btree `(id)`
* `subscription_event_processed_at_idx` btree `(processed_at)`
* `subscription_event_stripe_event_id_idx` btree `(stripe_event_id)`
* `subscription_event_stripe_event_id_key` UNIQUE CONSTRAINT, btree `(stripe_event_id)`
* `subscription_event_subscription_id_idx` btree `(subscription_id)`
* `subscription_event_type_idx` btree `(event_type)`

#### Foreign Key Constraints

* `subscription_event_subscription_id_fkey` FOREIGN KEY `(subscription_id)` REFERENCES `subscription(id)` ON DELETE SET NULL

---

### public.price\_plan

Stores subscription price plan details.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `stripe_price_id` | `text` | not null | |
| `tier` | `subscription_tier` | not null | |
| `name` | `text` | not null | |
| `amount_cents` | `integer` | not null | |
| `currency` | `text` | not null | `'usd'::text` |
| `interval` | `text` | not null | |
| `interval_count` | `integer` | not null | `1` |
| `description` | `text` | true | |
| `is_active` | `boolean` | not null | `true` |
| `cancel_at_period_end` | `boolean` | not null | `false` |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `price_plan_pkey` PRIMARY KEY, btree `(stripe_price_id)`
* `price_plan_is_active_idx` btree `(is_active)` WHERE `is_active = true`
* `price_plan_tier_idx` btree `(tier)`

#### Referenced by

* TABLE `subscription` CONSTRAINT `subscription_stripe_price_id_fkey` FOREIGN KEY `(stripe_price_id)` REFERENCES `price_plan(stripe_price_id)`

---

## STAGING & LOGGING TABLES

### public.alembic\_version

Record of the current alembic version number.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `version_num` | `character varying(32)` | not null | |

#### Indexes

* `alembic_version_pkc` PRIMARY KEY, btree `(version_num)`

---

### public.patent\_staging

A staging table for ingesting patent data before it's processed and moved to the main `patent` table.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub_id` | `text` | true | |
| `family_id` | `text` | true | |
| `kind_code` | `text` | true | |
| `title` | `text` | not null | |
| `abstract` | `text` | true | |
| `claims_text` | `text` | true | |
| `assignee_name` | `text` | true | |
| `inventor_name` | `jsonb` | true | |
| `cpc` | `jsonb` | true | |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |
| `application_number` | `text` | not null | |
| `priority_date` | `integer` | true | |
| `filing_date` | `integer` | true | |
| `pub date` | `integer` | not null | |
| `grant_date` | `integer` | true | |
| `citation publication numbers` | `text[]` | true | |
| `citation application_numbers` | `text[]` | true | |


#### Indexes

* `patent_staging_pkey` PRIMARY KEY, btree `(application number)`

---

### public.patent\_claim\_staging

Temporary storage for independent claims of patents in `patent_staging` before merging into `patent_claim`.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `get_random_uuid()` |
| `pub_id` | `text` | not null | |
| `claim_number` | `integer` | not null | |
| `is_independent` | `boolean` | not null | `false` |
| `claim_text` | `text` | true | |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |

#### Indexes

* `patent_claim_uq` UNIQUE CONSTRAINT, btree `(pub_id, claim_number)`

---

### public.issued\_patent\_staging

A staging table for ingesting patents corresponding to granted applications in the main `patent` table.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub_id` | `text` | not null | |
| `family_id` | `text` | true | |
| `kind_code` | `text` | true | |
| `title` | `text` | not null | |
| `abstract` | `text` | true | |
| `claims_text` | `text` | true | |
| `assignee_name` | `text` | true | |
| `inventor_name` | `jsonb` | true | |
| `cpc` | `jsonb` | true | |
| `created_at` | `timestamp with time zone` | not null | `now()` |
| `updated_at` | `timestamp with time zone` | not null | `now()` |
| `application_number` | `text` | not null | |
| `priority_date` | `integer` | true | |
| `filing_date` | `integer` | true | |
| `pub_date` | `integer` | not null | |


#### Indexes

* `issued_patent_staging_pkey` PRIMARY KEY, btree `(pub_id)`

---

### public.cited\_patent\_assignee\_raw 

A staging table for ingesting assignee names corresponding to `patent_citation.cited_pub_id`/`patent_citation.cited_application_number` entries that do not match any `patent.application_number` entries. 

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub_id` | `text` | not null | |
| `application_number` | `text` | not null | |
| `assignee_name_raw` | `text` | true | |

#### Indexes

* `cited_patent_assignee_raw_pkey` PRIMARY KEY, btree `(pub_id, application_number)`

---

### public.cited\_patent\_assignee\_raw\_dedup 

Deduplication copy of `cited_patent_assignee_raw`. 

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub_id` | `text` | true | |
| `application_number` | `text` | true | |
| `assignee_name_raw` | `text` | true | |

---

### public.ingest\_log

Logs data ingested into the main `patent` table.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `bigint` | not null | `nextval('ingest_log_id_seq'::regclass)` |
| `pub_id` | `text` | not null | |
| `stage` | `text` | not null | |
| `content_hash` | `text` | true | |
| `stage` | `jsonb` | true | |
| `created_at` | `timestamp with time zone` | not null | `now()` |


#### Indexes

* `ingest_log_pkey` PRIMARY KEY, btree `(id)`
* `ingest_log_pub_idx` btree `(pub_id, created_at DESC)`
* `uq_ingest_pub_stage` UNIQUE CONSTRAINT, btree `(pub_id, stage)`

---

## VIEWS

### public.active\_subscriptions

View to retrieve active subscription details for users.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | | |
| `user_id` | `text` | | |
| `stripe_subscription_id` | `text` | | |
| `tier` | `subscription_tier` | | |
| `status` | `subscription_status` | | |
| `current_period_start` | `timestamp with time zone` | | |
| `current_period_end` | `timestamp with time zone` | | |
| `tier_started_at` | `timestamp with time zone` | | |
| `days_in_current_tier` | `integer` | | |
| `requires_tier_migration` | `boolean` | | |
| `cancel_at_period_end` | `boolean` | | |
| `canceled_at` | `timestamp with time zone` | | |
| `plan_name` | `text` | | |
| `amount_cents` | `integer` | | |
| `currency` | `text` | | |
| `interval` | `text` | | |
| `email` | `text` | | |

#### View Query

    ```
        SELECT
            s.id,
            s.user_id,
            s.stripe_subscription_id,
            s.tier,
            s.status,
            s.current_period_start,
            s.current_period_end,
            s.tier_started_at,
            EXTRACT(
                day
                FROM
                now() - s.tier_started_at
            )::integer AS days_in_current_tier,
            CASE
                WHEN s.tier = 'beta_tester'::subscription_tier
                AND EXTRACT(
                    day
                    FROM
                        now() - s.tier_started_at
                ) >= 90::numeric THEN true
                ELSE false
            END AS requires_tier_migration,
            s.cancel_at_period_end,
            s.canceled_at,
            pp.name AS plan_name,
            pp.amount_cents,
            pp.currency,
            pp."interval",
            sc.email
        FROM
            subscription s
            JOIN price_plan pp ON s.stripe_price_id = pp.stripe_price_id
            JOIN stripe_customer sc ON s.user_id = sc.user_id
        WHERE
            (
                s.status = ANY (
                    ARRAY[
                        'active'::subscription_status,
                        'trialing'::subscription_status,
                        'past_due'::subscription_status
                    ]
                )
            )
            AND s.current_period_end > now()

    ```

---

### public.citation\_assignee\_resolved

View on assignees of cited patents/publications in the `patent_citation` table that are not in the `patent` table.

#### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub_id` | `text` | | |
| `application_number` | `text` | | |
| `canonical_assignee_name_id` | `uuid` | | |
| `assignee_alias_id` | `uuid` | | |

#### View Query

    ```
        SELECT
            p.pub_id,
            p.application_number,
            p.canonical_assignee_name_id,
            p.assignee_alias_id
        FROM patent p

        UNION ALL

        SELECT
            cpa.pub_id,
            cpa.application_number,
            cpa.canonical_assignee_name_id,
            cpa.assignee_alias_id
        FROM cited_patent_assignee cpa
        WHERE NOT EXISTS (
            SELECT 1
            FROM patent p
            WHERE (p.pub_id IS NOT NULL AND p.pub_id = cpa.pub_id)
            OR (p.application_number IS NOT NULL AND p.application_number = cpa.application_number)
        );

    ```
