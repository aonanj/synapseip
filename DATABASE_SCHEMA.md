# Database Schema

This document outlines the database schema for the project. The database is a **PostgreSQL 17** instance hosted on [**Neon**](https://neon.tech/).

## Table of Contents

### Tables

* [public.patent](#publicpatent)
* [public.patent\_embeddings](#publicpatent_embeddings)
* [public.patent\_citation](#publicpatent_citation)
* [public.patent\_claim](#publicpatent_claim)
* [public.patent\_claim\_embeddings](#publicpatent_claim_embeddings)
* [public.user\_overview\_analysis](#publicuser_overview_analysis)
* [public.knn\_edge](#publicknn_edge)
* [public.alert\_event](#publicalert_event)
* [public.app\_user](#publicapp_user)
* [public.assignee\_alias](#publicassignee_alias)
* [public.canonical\_assignee\_name](#publiccanonical_assignee_name)
* [public.cited\_patent\_assignee](#publiccited_patent_assignee)
* [public.saved\_query](#publicsaved_query)
* [public.stripe\_customer](#publicstripe_customer)
* [public.subscription](#publicsubscription)
* [public.subscription\_event](#publicsubscription_event)
* [public.price\_plan](#publicprice_plan)

### Staging & Logging Tables

* [public.patent\_staging](#publicpatent_staging)
* [public.patent\_claim\_staging](#publicpatent_claim_staging)
* [public.issued\_patent\_staging](#publicissued_patent_staging)
* [public.cited\_patent\_assignee\_raw](#publiccited_patent_assignee_raw)
* [public.cited\_patent\_assignee\_raw\_dedup](#publiccited_patent_assignee_raw_dedup)
* [public.ingest\_log](#publicingest_log)

### Views

* [public.active\_subscriptions](#publicactive_subscriptions)
* [public.citation\_assignee\_resolved](#publiccitation_assignee_resolved)

---

## public.patent

Stores the core patent data. Entries in this table have at least one AI/ML-related CPC code and explicitly refer to AI/ML-related subject matter in the title, claims, and/or abstract. 

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub id` | `text` | not null | |
| `family id` | `text` | true | |
| `kind code` | `text` | true | |
| `title` | `text` | not null | |
| `abstract` | `text` | true | |
| `claims text` | `text` | true | |
| `assignee name` | `text` | true | |
| `inventors` | `jsonb` | true | |
| `cpc` | `jsonb` | true | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |
| `application number` | `text` | true | |
| `priority date` | `integer` | true | |
| `filing date` | `integer` | true | |
| `pub date` | `integer` | not null | |
| `canonical assignee name id` | `uuid` | true | |
| `assignee alias id` | `uuid` | true | |


### Indexes

* `patent pkey` (Primary Key, btree) on `(pub id)`
* `patent abstract trgm idx` gin `(abstract gin_trgm_ops)`
* `patent application number key` (Unique Constraint, btree) on `(application_number)`
* `patent assignee idx` (btree) on `(assignee name)`
* `patent claims idx` gin `(to_tsvector('english'::regconfig, claims_text))`
* `patent cpc jsonb idx` gin on `(cpc jsonb_path_ops)`
* `patent search_expr_gin` gin `(((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(abstract, ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(claims_text, ''::text)), 'C'::"char")))`
* `patent title_tron_idx` gin `(title gin_trgm_ops)`
* `patent tsv idx` gin `(to_tsvector('english'::regconfig, (COALESCE(title, ''::text) || ' '::text) || COALESCE(abstract, ''::text)))`

### Referenced By

* TABLE `patent_claim` CONSTRAINT `fk_patent` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON DELETE CASCADE
* TABLE `patent_assignee` CONSTRAINT `patent_assignee_pub_id_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE
* TABLE `patent_citation` CONSTRAINT `patent_citation_pub_id_patent_pub_id_fkey` FOREIGN KEY `(citing_pub_id)` REFERENCES `patent(pub_id)`
* TABLE `patent_embeddings` CONSTRAINT `patent_embeddings_pub_id_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON UPDATE CASCADE ON DELETE CASCADE
* TABLE `user_overview_analysis` CONSTRAINT `user_overview_analysis_patent_fkey` FOREIGN KEY `(pub_id)` REFERENCES `patent(pub_id)` ON DELETE CASCADE

### Triggers

* `trg_patent_updated_at` BEFORE UPDATE ON `patent` FOR EACH ROW EXECUTE FUNCTION `set_updated_at()`

---

## public.patent\_embeddings

Stores vector embeddings for patent data. `model` indicates which field(s) in the `patent` table are used to generate each embedding: `|ta` suffix indicates an embedding generated using `patent.title` and `patent.abstract`; `|c` suffix indicates an embedding generated using `patent.claim_text`.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `integer` | not null | `generated always as identity` |
| `pub id` | `text` | not null | |
| `model` | `text` | not null | |
| `dim` | `integer` | not null | |
| `created at` | `timestamp with time zone` | not null | |
| `embedding` | `vector(1536)` | true | |


### Indexes

* `patent embeddings pkey` (Primary Key, btree) on `(id)`
* `patent embeddings_hnaw_idx_claims` (hnsw) WHERE `model = 'text-embedding-3-small claims'`
* `patent embeddings insw idx ta` (hnsw) WHERE `modal = 'text-embedding-3-small ta'`
* `patent embeddings model idx` (Unique, btree) on `(model, pub id)`

### Foreign Key Constraints

* `patent anbeddinga_pub_id_fkey` FOREIGN KEY `(pub id)` REFERENCES `patent(pub id)` ON DELETE CASCADE

---

## public.patent\_citation

Links patents in the `patent` table to the patents and publications they cite via `application_number`.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `bigint` | not null | `nextval('patent_citation_id_seq'::regclass)` |
| `citing pub id` | `text` | true | |
| `cited application number` | `text` | not null | |
| `cited pub id` | `text` | true | |
| `cite type` | `text` | true | |
| `cited filing date` | `integer` | true | |
| `cited priority date` | `integer` | true | |
| `relation source` | `text` | true | `'bigquery'::text` |
| `created at` | `timestamp with time zone` | true | `now()` |


### Indexes

* `patent_citation_pkey` PRIMARY KEY, btree `(id)`
* `patent_citation_cited_application_number_idx` btree `(cited_application_number)`
* `patent_citation_citing_pub_id_idx` btree `(citing_pub_id)`

### Foreign Key Constraints

* `patent_citation_citing_pub_id_fkey` FOREIGN KEY `(citing_pub_id)` REFERENCES `patent(pub_id)` ON DELETE CASCADE

---

## public.patent\_claim

Stores independent claims of patents in the `patent` table for generating claim-specific embeddings.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `get_random_uuid()` |
| `pub id` | `text` | not null | |
| `claim_number` | `integer` | not null | |
| `is independent` | `boolean` | not null | `false` |
| `claim text` | `text` | true | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `patent_claim_pkey` PRIMARY KEY, btree `(id)`
* `idx_patent_claim_pub_id` btree `(pub_id)`
* `uq_patent_claim` UNIQUE CONSTRAINT, btree `(pub_id, claim_number)`

### Foreign Key Constraints

* `patent fkey` FOREIGN KEY `(pub id)` REFERENCES `patent(pub id)` ON DELETE CASCADE

### Referenced By

* TABLE `patent_claim_embeddings` CONSTRAINT `embeddings_pub_id_claim_no_patent_claim_fkey` FOREIGN KEY `(pub_id, claim_number)` REFERENCES `patent_claim(pub_id, claim_number)` ON UPDATE CASCADE ON DELETE CASCADE

---

## public.patent\_claim\_embeddings

Stores embeddings generated for individual independent claims of patents in the `patent_claim` table. 

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `bigint` | not null | `generated always as identity` |
| `pub id` | `text` | not null | |
| `claim_number` | `integer` | not null | |
| `dim` | `integer` | not null | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `embedding` | `vector(1536)` | true | |


### Indexes

* `patent_claim_embeddings_pkey` PRIMARY KEY, btree `(id)`
* `idx_patent_claim_embeddings_pub_id` btree `(pub_id, claim_number)`
* `patent_claim_embeddings_hnsw_idx_claim_model` hnsw `(embedding vector_cosine_ops)`
* `uq_patent_claim_number` UNIQUE CONSTRAINT, btree `(pub_id, claim_number)`

### Foreign Key Constraints

* `embeddings_pub_id_claim_no_patent_claim_fkey` FOREIGN KEY `(pub_id, claim_number)` REFERENCES `patent_claim(pub_id, claim_number)` ON UPDATE CASCADE ON DELETE CASCADE

---

## public.user\_overview\_analysis

Stores analysis results, like clustering and scoring, for user-specific query runs on the frontend Overview Analysis page.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `user id` | `text` | not null | |
| `pub id` | `text` | not null | |
| `model` | `text` | not null | |
| `cluster id` | `integer` | true | |
| `local density` | `real` | true | |
| `overview score` | `real` | true | |
| `created at` | `timestamp with time zone` | true | `now()` |
| `updated at` | `timestamp with time zone` | true | `now()` |


### Indexes

* `user overview analysis pkey` (Primary Key, btree) on `(user id, pub id, model)`
* `user cluster stats idx` (btree) on `(user id, cluster id, model)` WHERE `cluster id IS NOT NULL`
* `user overview analysis cluster id idx` (btree) on `(cluster id)` WHERE `cluster id IS NOT NULL`
* `user overview analysis model idx` (btree) on `(model)`
* `user overview analysis pub id ids` (btree) on `(pub id)`
* `user overview analysis user id idx` (btree) on `(user id)`

### Foreign Key Constraints

* `user overview analysis patent fkey` FOREIGN KEY `(pub id)` REFERENCES `patent(pub id)` ON DELETE CASCADE

---

## public.knn\_edge

Represents edges in a user-specific K-Nearest Neighbors graph for similarity analysis.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `src` | `text` | not null | |
| `dst` | `text` | not null | |
| `w` | `real` | true | |
| `user id` | `text` | not null | |


### Indexes

* `knn edge pkey` (Primary Key, btree) on `(user id, src, dst)`
* `knn edge user_id_idx` (btree) on `(user_id)`

---

## public.alert\_event

Stores events generated by alerts, which are tied to saved queries.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `saved query id` | `uuid` | not null | |
| `created at` | `timestamp with time zone` | not null | |
| `results sample` | `jsonb` | not null | |
| `count` | `integer` | not null | |


### Indexes

* `alert event pkey` (Primary Key, btree) on `(id)`
* `alert event saved query idx` (btree) on `(saved query id, created_at DESC)`

### Foreign Key Constraints

* `alert event saved query id fkey` FOREIGN KEY `(saved query id)` REFERENCES `saved_query(id)` ON DELETE CASCADE

---

## public.app\_user

Stores user account information.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `text` | not null | |
| `email` | `citext` | true | |
| `display name` | `text` | true | |
| `created at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `app user pkey` (Primary Key, btree) on `(id)`
* `app user email key` (Unique Constraint, btree) on `(email)`

### Referenced By

* TABLE `saved query` CONSTRAINT `saved_query_app_user_fkey` FOREIGN KEY `(owner_id)` REFERENCES `app_user(id)` ON DELETE CASCADE

---

## public.assignee\_alias

Links different assignee name aliases to a single canonical ID and canonical assignee name.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `canonical id` | `uuid` | not null | |
| `assignee alias` | `text` | not null | |
| `source` | `text` | true | |
| `created at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `ansignee_alias pkey` (Primary Key, btree) on `(id)`
* `assignee alias assignee alias key` (Unique Constraint, btree) on `(assignee alias)`
* `assignee id canonical id ug` (Unique Constraint, btree) on `(id, canonical_id)`
* `canonical in assignee alias uq` (Unique Constraint, btree) on `(canonical id, assignee_alias)`

### Foreign Key Constraints

* `assignee alias canonicalid_fkey` FOREIGN KEY `(canonical id)` REFERENCES `canonical_assignee_name(id)` ON UPDATE CASCADE ON DELETE CASCADE

### Referenced By

* TABLE `cited_patent_assignee` CONSTRAINT `cited_patent_assignee_assignee_alias_id_fkey` FOREIGN KEY `(assignee_alias_id)` REFERENCES `assignee_alias(id)`
* TABLE `patent assignee` CONSTRAINT `patent assignee alias id fkey` FOREIGN KEY `(alias_id)` REFERENCES `assignee_alias(id)` ON UPDATE CASCADE

---

## public.canonical\_assignee\_name

Stores the single, canonical name for an assignee.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `canonical assignee name` | `text` | not null | |
| `created at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `canonical assignee name pkey` (Primary Key, btree) on `(id)`
* `uq_canonical_assignee_name` (Unique Constraint, btree) on `(canonical_assignee_name)`

### Referenced By

* TABLE `assignee_alias` CONSTRAINT `assignee_alias_canonical_id_fkey` FOREIGN KEY `(canonical_id)` REFERENCES `canonical_assignee_name(id)` ON UPDATE CASCADE ON DELETE CASCADE
* TABLE `cited_patent_assignee` CONSTRAINT `cited_patent_assignee_canonical_assignee_name_id_fkey` FOREIGN KEY `(canonical_assignee_name_id)` REFERENCES `canonical_assignee_name(id)`
* TABLE `patent_assignee` CONSTRAINT `patent_assignee_canonical_id_fkey` FOREIGN KEY `(canonical_id)` REFERENCES `canonical_assignee_name(id)` ON UPDATE CASCADE

---

## public.cited\_patent\_assignee

Stores information mapping assignees corresponding to entries in `patent_citation.cited_pub_id`/`patent_citation.cited_application_number` to a canonical assignee name in `canonical_assignee_name`. Does not store mappings for `patent_citation.cited_pub_id`/`patent_citation.cited_application_number` that match on `patent.application_number` (those mappings are available using the `patent` table).

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `pub_id` | `text` | true | |
| `application_number` | `text` | true | |
| `canonical assignee name id` | `uuid` | true | |
| `assignee alias id` | `uuid` | true | |
| `source` | `text` | not null | `'uspto_odp'::text` |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `cited_patent_assignee_pkey` PRIMARY KEY, btree `(id)`
* `cited_patent_assignee_application_number_key` UNIQUE CONSTRAINT, btree `(application_number)`
* `cited_patent_assignee_pub_id_key` UNIQUE CONSTRAINT, btree `(pub_id)`

### Foreign-key constraints:

* `cited_patent_assignee_assignee_alias_id_fkey` FOREIGN KEY `(assignee_alias_id)` REFERENCES `assignee_alias(id)`
* `cited_patent_assignee_canonical_assignee_name_id_fkey` FOREIGN KEY `(canonical_assignee_name_id)` REFERENCES `canonical_assignee_name(id)`

---

## public.saved\_query

Stores user-defined queries, which can be run on a schedule to generate alerts.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `owner id` | `text` | not null | |
| `name` | `text` | not null | |
| `filters` | `jsonb` | not null | |
| `semantic query` | `text` | true | |
| `schedule cron` | `text` | true | |
| `is active` | `boolean` | not null | `true` |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | |


### Indexes

* `saved query pkey` (Primary Key, btree) on `(id)`
* `uq saved query owner name` (Unique Constraint, btree) on `(owner id, name)`

### Foreign Key Constraints

* `saved query app user fkey` FOREIGN KEY `(owner id)` REFERENCES `app_user(id)` ON DELETE CASCADE

### Referenced By

* TABLE `alert_event` CONSTRAINT `alert_event_saved_query_id_fkey` FOREIGN KEY `(saved_query_id)` REFERENCES `saved_query(id)` ON DELETE CASCADE

### Triggers

* `trg_saved_query_updated_at` BEFORE UPDATE ON `saved_query` FOR EACH ROW EXECUTE FUNCTION `set_updated_at()`

---

## public.stripe\_customer

Maps a user ID to a Stripe Customer ID for billing and subscription verification.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `user id` | `text` | not null | |
| `stripe customer id` | `text` | not null | |
| `email` | `text` | not null | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `stripe customer pkey` (Primary Key, btree) on `(user id)`
* `stripe customer email idx` (btree) on `(email)`
* `stripe customer stripe customer id key` (Unique Constraint, btree) on `(stripe customer id)`
* `stripe customer stripe id idx` (btree) on `(stripe customer id)`

### Referenced By

* TABLE `subscription` CONSTRAINT `subscription_stripe_customer_id_fkey` FOREIGN KEY `(stripe_customer_id)` REFERENCES `stripe_customer(stripe_customer_id)` ON DELETE CASCADE
* TABLE `subscription` CONSTRAINT `subscription_user_id_fkey` FOREIGN KEY `(user_id)` REFERENCES `stripe_customer(user_id)` ON DELETE CASCADE

---

## public.subscription

Stores subscription details for users, linking them to Stripe plans and customers.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `user id` | `text` | not null | |
| `stripe subscription id` | `text` | not null | |
| `stripe customer id` | `text` | not null | |
| `stripe price id` | `text` | not null | |
| `tier` | `subscription_tier` | not null | |
| `status` | `subscription_status` | not null | |
| `current period start` | `timestamp with time zone` | not null | |
| `current period end` | `timestamp with time zone` | not null | |
| `cancel at period end` | `boolean` | not null | `false` |
| `canceled at` | `timestamp with time zone` | true | |
| `tier started at` | `timestamp with time zone` | not null | `now()` |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `subscription pkey` (Primary Key, btree) on `(id)`
* `subscription period end idx` (btree) on `(current period_end)`
* `subscription status idx` (btree) on `(status)`
* `subscription tier idx` (btree) on `(tier)`
* `subscription_stripe_subscription_id_idx` (btree) on `(stripe_subscription_id)`
* `subscription stripe subscription_id_key` (Unique Constraint, btree) on `(stripe_subscription_id)`
* `subscription user id idx` (btree) on `(user id)`
* `subscription user status idx` (btree) on `(user id, status)`

### Foreign Key Constraints

* `subscription_stripe_customer_id fkey` FOREIGN KEY `(stripe_customer_id)` REFERENCES `stripe_customer(stripe_customer id)` ON DELETE CASCADE
* `subscription stripe price id fkey` FOREIGN KEY `(stripe_price_id)` REFERENCES `price_plan(stripe_price_id)`
* `subscription_user_id_fkey` FOREIGN KEY `(user id)` REFERENCES `stripe_customer(user id)` ON DELETE CASCADE

### Referenced By

* TABLE `subscription event` CONSTRAINT `subscription_event_subscription_id_fkey` FOREIGN KEY `(subscription_id)` REFERENCES `subscription(id)` ON DELETE SET NULL

---

## public.subscription\_event

Logs incoming webhook events from Stripe related to subscriptions.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `stripe event id` | `text` | not null | |
| `subscription id` | `uuid` | true | |
| `event type` | `text` | not null | |
| `event data` | `jsonb` | not null | |
| `processed at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `subscription event pkey` (Primary Key, btree) on `(id)`
* `subscription event processed at idx` (btree) on `(processed at)`
* `subscription event stripe event id idx` (btree) on `(stripe event id)`
* `subscription event_stripe_event_id_key` (Unique Constraint, btree) on `(stripe_event_id)`
* `subscription event subscription id idx` (btree) on `(subscription id)`
* `subscription event type idx` (btree) on `(event type)`

### Foreign Key Constraints

* `subscription event subscription id_fkey` FOREIGN KEY `(subscription id)` REFERENCES `subscription(id)` ON DELETE SET NULL

---

## public.price\_plan

Stores subscription price plan details.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `stripe price id` | `text` | not null | |
| `tier` | `subscription_tier` | not null | |
| `name` | `text` | not null | |
| `amount cents` | `integer` | not null | |
| `currency` | `text` | not null | `'usd'::text` |
| `interval` | `text` | not null | |
| `interval count` | `integer` | not null | `1` |
| `description` | `text` | | |
| `is active` | `boolean` | not null | `true` |
| `cancel at period end` | `boolean` | not null | `false` |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `price_plan_pkey` PRIMARY KEY, btree `(stripe_price_id)`
* `price_plan_is_active_idx` btree `(is_active)` WHERE `is_active = true`
* `price_plan_tier_idx` btree `(tier)`

### Referenced by

* TABLE `subscription` CONSTRAINT `subscription_stripe_price_id_fkey` FOREIGN KEY `(stripe_price_id)` REFERENCES `price_plan(stripe_price_id)`

---

## public.patent\_staging

A staging table for ingesting patent data before it's processed and moved to the main `patent` table.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub id` | `text` | true | |
| `family_id` | `text` | true | |
| `kind code` | `text` | true | |
| `title` | `text` | not null | |
| `abstract` | `text` | true | |
| `claims text` | `text` | true | |
| `assignee name` | `text` | true | |
| `inventor name` | `jsonb` | true | |
| `cpc` | `jsonb` | true | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |
| `application number` | `text` | not null | |
| `priority date` | `integer` | true | |
| `filing date` | `integer` | true | |
| `pub date` | `integer` | not null | |
| `grant date` | `integer` | true | |
| `citation publication numbers` | `text[]` | true | |
| `citation application_numbers` | `text[]` | true | |


### Indexes

* `patent staging pkey` (Primary Key, btree) on `(application number)`

---

## public.patent\_claim\_staging

Temporary storage for independent claims of patents in `patent_staging` before merging into `patent_claim`.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | not null | `get_random_uuid()` |
| `pub id` | `text` | not null | |
| `claim_number` | `integer` | not null | |
| `is independent` | `boolean` | not null | `false` |
| `claim text` | `text` | true | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |

### Indexes

* `patent_claim_uq` UNIQUE CONSTRAINT, btree `(pub_id, claim_number)`

---

## public.issued\_patent\_staging

A staging table for ingesting patents corresponding to granted applications in the main `patent` table.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub id` | `text` | not null | |
| `family_id` | `text` | true | |
| `kind code` | `text` | true | |
| `title` | `text` | not null | |
| `abstract` | `text` | true | |
| `claims text` | `text` | true | |
| `assignee name` | `text` | true | |
| `inventor name` | `jsonb` | true | |
| `cpc` | `jsonb` | true | |
| `created at` | `timestamp with time zone` | not null | `now()` |
| `updated at` | `timestamp with time zone` | not null | `now()` |
| `application number` | `text` | not null | |
| `priority date` | `integer` | true | |
| `filing date` | `integer` | true | |
| `pub date` | `integer` | not null | |


### Indexes

* `issued patent staging pkey` (Primary Key, btree) on `(pub_id)`

---

## public.cited\_patent\_assignee\_raw 

A staging table for ingesting assignee names corresponding to `patent_citation.cited_pub_id`/`patent_citation.cited_application_number` entries that do not match any `patent.application_number` entries. 

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub id` | `text` | true | |
| `application number` | `text` | true | |
| `assignee name raw` | `text` | true | |

### Indexes

* `cited_patent_assignee_raw_pkey` PRIMARY KEY, btree `(pub_id, application_number)`

---

## public.cited\_patent\_assignee\_raw\_dedup 

Deduplication copy of `cited_patent_assignee_raw`. 

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub id` | `text` | true | |
| `application number` | `text` | true | |
| `assignee name raw` | `text` | true | |

---

## public.ingest\_log

Logs data ingested into the main `patent` table.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `bigint` | not null | `nextval('ingest_log_id_seq'::regclass)` |
| `pub_id` | `text` | not null | |
| `stage` | `text` | not null | |
| `content_hash` | `text` | true | |
| `stage` | `jsonb` | true | |
| `created at` | `timestamp with time zone` | not null | `now()` |


### Indexes

* `ingest_log_pkey` PRIMARY KEY, btree `(id)`
* `ingest_log_pub_idx` btree `(pub_id, created_at DESC)`
* `uq_ingest_pub_stage` UNIQUE CONSTRAINT, btree `(pub_id, stage)`

---

## public.active\_subscriptions

View to retrieve active subscription details for users.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | | |
| `user id` | `text` | | |
| `stripe subscription id` | `text` | | |
| `tier` | `subscription_tier` | | |
| `status` | `subscription_status` | | |
| `current period start` | `timestamp with time zone` | | |
| `current period end` | `timestamp with time zone` | | |
| `tier started at` | `timestamp with time zone` | | |
| `days in current tier` | `integer` | | |
| `requires tier migration` | `boolean` | | |
| `cancel at period end` | `boolean` | | |
| `canceled at` | `timestamp with time zone` | | |
| `plan name` | `text` | | |
| `amount cents` | `integer` | | |
| `currency` | `text` | | |
| `interval` | `text` | | |
| `email` | `text` | | |

### View Query

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

## public.citation\_assignee\_resolved

View on assignees of cited patents/publications in the `patent_citation` table that are not in the `patent` table.

### Columns

| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| `pub_id` | `text` | true | |
| `application_number` | `text` | true | |
| `canonical assignee name id` | `uuid` | true | |
| `assignee alias id` | `uuid` | true | |

### View Query

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
