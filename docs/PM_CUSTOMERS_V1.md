# PM HANDOFF — CUSTOMERS V1

## Base
`758ae2e86a45132e81cac1ec6ba3c9f8d9fcf7be`

## Migration
Apply once: `migrations/0004_customers.sql`.

Expected table: `customers`.

Do not seed or backfill customers from reservations in this phase.

## Backend QA
- Unauthenticated `GET /api/admin/customers` => 401.
- Authenticated list => 200.
- Create customer with name + email or phone => 201.
- Missing both email and valid phone => 400.
- Invalid email/language/status => 400.
- Duplicate non-null email => 409.
- Edit customer => 200.
- Invalid customer id / missing record => 400/404.
- Cross-origin POST/PATCH => 403.
- Audit events: `customer_created`, `customer_updated`.

## Frontend QA
Open `/admin/clientes`.

Verify:
- real KPIs from MySQL;
- empty state when no records exist;
- create modal;
- edit modal;
- search by name/email/phone/country;
- active/inactive filter;
- marketing opt-in is explicit;
- responsive desktop/mobile;
- no hardcoded customer rows.

## Dashboard
After migration, Dashboard must detect `customers` as available and show the real count.

## Preservation
Do not modify the 6 existing QA reservations and do not infer customer links from reservation names, emails, or phones.

## Regression
Verify landing, login, auth, dashboard, reservations, tours, logout, health, and database.

## Source policy
PM does not modify source. On code failure: DOCUMENT → REPORT → WAIT FOR DEVELOPER.

Expected result: `CUSTOMERS V1 = PASS`.
