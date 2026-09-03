# PM HANDOFF — TOURS V1

Base: `650257b950a24b0e8b3a2ec3f96337bc0f2e102c`

## Scope

- New normalized `tours` table.
- Nullable `reservations.tour_id` FK to `tours.id`; existing reservations are preserved and remain nullable.
- Authenticated admin API for list, options, create and update.
- `/admin/tours` responsive admin screen with real MySQL data only.
- Dashboard will automatically detect the new `tours` table.
- No destructive delete endpoint in V1; use `inactive` status instead.
- No seed data and no automatic backfill by text name.

## Migration

Apply only `migrations/0003_tours.sql` once after confirming the deployed SHA.

Expected:
- table `tours`
- index/constraints from migration
- nullable `reservations.tour_id`
- FK `fk_reservations_tour`
- current reservation rows preserved

## QA

1. Build/redeploy exact SHA supplied by Developer.
2. `/api/health` database=ok.
3. Without session, `/api/admin/tours` must return 401.
4. With session, GET `/api/admin/tours` returns 200 and real summary.
5. `/admin/tours` renders desktop/mobile.
6. Create one QA tour through the UI/API, then edit it and move through draft/published/inactive.
7. Duplicate slug must return 409.
8. Cross-origin state-changing request must remain blocked.
9. `/api/admin/tours/options` returns only published tours.
10. Dashboard must show Tours available after migration.
11. Existing reservations must remain unchanged; do not backfill `tour_id` by matching names.
12. Regression: landing, login, dashboard, reservations, logout.

If a code problem appears: document, report, wait for Developer. PM must not edit source.
