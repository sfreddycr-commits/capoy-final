# PM — CMS V1 DEPLOY + QA

## Base
`c38b9f0ea2123c7b23e7adaa45d47e6b3d31c316`

## Migration
Apply once: `migrations/0009_cms.sql`

Creates `cms_settings` and inserts the current approved production landing values as baseline CMS content. These are not fake QA records; they preserve the current public copy when CMS becomes active.

## Expected API
- `GET /api/public/cms` public, 200
- `GET /api/admin/cms` authenticated, 401 without session
- `PATCH /api/admin/cms` authenticated + same-origin

## CMS fields
- hero_eyebrow
- hero_title
- hero_lead
- hero_primary_cta
- hero_secondary_cta
- hero_image
- contact_phone
- contact_email
- contact_location
- cta_title
- cta_copy
- footer_copy

## QA API
1. Public endpoint returns current baseline values.
2. Admin GET returns values + updatedAt.
3. PATCH with malicious Origin -> 403.
4. PATCH without session -> 401.
5. Invalid email -> 400.
6. Invalid hero image URL -> 400.
7. Unknown field -> 400.
8. Valid PATCH -> 200 and `cms_updated` audit event.
9. Re-read public endpoint and confirm changed values are visible.

## Frontend
Route: `/admin/cms`

Verify:
- protected route
- desktop and mobile
- fields grouped as Hero / Contact / Closing & footer
- save works
- `Ver sitio público` opens public landing

## Public landing integration
After saving a safe temporary QA value in one field (recommended: `hero_eyebrow`), reload `/` and confirm the public landing shows the updated text without code/deploy.

Restore the original baseline value before closing QA.

Also verify `contact_phone`, `cta_title`, and `footer_copy` with temporary values one at a time if desired, restoring each afterward.

## Hero image
`hero_image` may be blank. Blank means keep the existing CSS hero image. If a valid HTTPS image URL is saved, the public hero must use it. Restore blank after QA unless PO approves a permanent change.

## Regression baseline
Keep intact:
- reservations = 8
- tours = 3
- customers = 7
- providers = 5
- fleet = 5
- reviews = 6

Run regression:
LANDING / LOGIN / AUTH / DASHBOARD / RESERVAS / TOURS / CLIENTES / PROVEEDORES / FLOTA / RESEÑAS / CMS / LOGOUT / HEALTH / DATABASE.

## Source drift
Expected: NONE.

If code fails: DOCUMENTAR -> REPORTAR -> ESPERAR AL DEVELOPER. OpenCode does not edit source.

## Expected result
`CMS V1 = PASS`
