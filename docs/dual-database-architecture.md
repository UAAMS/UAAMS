# UAAMS Dual Database Architecture (PostgreSQL + MongoDB)

## Data Placement

### PostgreSQL (Structured / Relational)
- `roles`
- `users`
- `student_profiles`
- `universities`
- `programs`
- `applications`
- `payments`

### MongoDB (Semi-Structured)
- Dynamic template form definitions (`UniversityTemplate`)
- Dynamic template submissions (`TemplateSubmission`)
- Recommendation snapshots (`RecommendationSnapshot`)
- Outbox sync queue (`StructuredSyncOutbox`)

### MongoDB (Unstructured / Content & Documents)
- Blogs / comments
- Announcements
- Application documents embedded in form/template data URLs
- Roll-number slips (file URLs/data URLs)
- Admission/offer letters (file URLs/data URLs)

## Consistency Strategy

UAAMS uses an **Outbox-based eventual consistency** model between MongoDB and PostgreSQL:

1. API writes continue to MongoDB through existing flows.
2. Mongo model hooks queue sync events in `StructuredSyncOutbox`.
3. A background worker reads pending/failed events and upserts/deletes structured rows in PostgreSQL.
4. Failed events are retried with backoff until they succeed.

This avoids data loss during temporary PostgreSQL outages and keeps user-facing APIs responsive.

## Persistence Guarantees

- **Durable sync intent:** Every structured mutation is persisted as outbox event (when `ENABLE_PSQL=true`).
- **Idempotent sync:** PostgreSQL writes use upsert semantics.
- **Retry on failure:** failed events remain in outbox for retry.
- **Recoverability:** `backfill:structured` script can rebuild PostgreSQL state from MongoDB.

## Runtime Components

- PostgreSQL store bootstrap: `backend/src/structured/store.js`
- Sync service: `backend/src/structured/syncService.js`
- Outbox queue helper: `backend/src/structured/queue.js`
- Worker: `backend/src/structured/worker.js`
- Health includes DB + outbox status: `GET /api/health`

## Environment Variables (Backend)

Set these in backend `.env`:

- `ENABLE_PSQL=true`
- `PG_HOST=127.0.0.1`
- `PG_PORT=5432`
- `PG_DATABASE=uaams`
- `PG_USER=postgres`
- `PG_PASSWORD=your_password`
- `PG_SSL=false`
- `PSQL_SYNC_SCHEMA=true`
- `PSQL_LOG_QUERIES=false`

## Enable + Backfill

1. Install backend dependencies:
   - `npm install`
4. Ensure PostgreSQL database exists and the PostgreSQL server is running.
   - If PostgreSQL is not running, backend startup will fail with `ECONNREFUSED 127.0.0.1:5432`.
   - If you want to run the backend without Postgres sync for now, set `ENABLE_PSQL=false` in `.env`.
3. Enable vars above.
4. Backfill existing Mongo structured data:
   - `npm run backfill:structured`
5. Start backend:
   - `npm run dev`
6. Verify:
   - `GET /api/health` should show Mongo connected, PostgreSQL ready, outbox pending/failed near zero.

## Notes

- This architecture uses eventual consistency, not distributed ACID transactions across MongoDB and PostgreSQL.
- For stricter guarantees later, add an explicit reconciliation/repair command for stale records and alerting on outbox failures.
