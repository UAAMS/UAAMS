# Phase 2 Optimization: Redis Caching + File Path Storage

## Storage backend decision
- Default driver is now `local` (`FILE_STORAGE_DRIVER=local`) for zero-friction development and immediate rollout.
- Production can switch to `s3` by setting `FILE_STORAGE_DRIVER=s3` with `S3_*` env values.
- The backend now writes only file URLs/paths to MongoDB for:
  - student profile documents
  - application form uploaded fields
  - announcement attachments
  - blog images
  - roll-number slips
  - admission letters

## Cache backend decision
- Redis is now first-class through `REDIS_URL`.
- In-memory cache remains as automatic fallback if Redis is unavailable.
- Existing university list/detail/form and recommendation dataset caching now read/write through this unified cache client.

## Migration plan
1. Configure env for storage and Redis (`backend/.env`):
   - local: `FILE_STORAGE_DRIVER=local`, `UPLOADS_PUBLIC_BASE_URL`
   - s3: `FILE_STORAGE_DRIVER=s3` plus required `S3_*`
   - cache: `REDIS_URL`, optional `REDIS_PREFIX`
2. Restart backend so `/uploads` static route and cache/storage adapters are active.
3. Run one-time migration:
   - `npm run migrate:uploads` (from `backend/`)
4. Validate:
   - New/updated records should store URL/path strings, not `data:*;base64,...`
   - Existing migrated records should also be URL/path strings.
5. Optional cutover hardening:
   - After validation, reject `data:` payloads from clients and require only URLs for write APIs.
