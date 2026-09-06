# PM — HANDOFF AUDITORÍA DEDICADA V1

## OBJETIVO
Convertir `admin_audit_log` en una pantalla administrativa consultable, sin crear una segunda fuente de auditoría.

## RUTA
`/admin/auditoria`

## API
`GET /api/admin/audit`

## SEGURIDAD
- Sin sesión: 401
- Usuario `admin`: 403
- Usuario `owner`: 200
- Solo lectura. No existe POST/PATCH/DELETE para el log.

## FILTROS
Query params soportados:
- `q`
- `eventType`
- `period`: `24h`, `7d`, `30d`, `90d`, `all`
- `page`
- `limit`

## RESPUESTA
Debe incluir:
- summary.total
- summary.last24h
- summary.actors
- summary.eventTypes
- pagination
- eventTypes
- events

Cada evento puede incluir:
- id
- userId
- displayName
- email
- eventType
- ipAddress
- userAgent
- metadata
- createdAt

Nunca debe exponer contraseñas, hashes, cookies o tokens.

## QA
1. Owner: GET 200.
2. Admin: GET 403.
3. Sin sesión: GET 401.
4. period inválido: 400.
5. Probar 24h/7d/30d/90d/all.
6. Probar filtro por eventType existente.
7. Probar búsqueda por email, nombre de usuario, tipo de evento e IP.
8. Probar paginación con limit >=10.
9. Verificar orden descendente por fecha.
10. Verificar metadata JSON legible.
11. Confirmar que eventos existentes como login_success, cms_updated, admin_user_updated, settings_updated aparecen si existen en baseline.
12. Verificar UI desktop y mobile.

## BASELINE A PRESERVAR
- reservations = 8
- tours = 3
- customers = 7
- providers = 5
- fleet = 5
- reviews = 6
- cms_settings = 13
- admin_users = 2
- app_settings = 8

No limpiar QA.

## MIGRACIÓN
NO HAY MIGRACIÓN.

Se reutiliza `admin_audit_log` existente.

## REGRESIÓN
Landing, Login/Auth, Dashboard, Reservas, Tours, Clientes, Proveedores, Flota, Reseñas, CMS, Usuarios, Configuración, Auditoría, Logout, Health y Database.

## SOURCE DRIFT
Esperado: NONE.

Ante fallo de código: DOCUMENTAR → REPORTAR → ESPERAR AL DEVELOPER.
OpenCode no modifica código.

## RESULTADO ESPERADO
AUDITORÍA DEDICADA V1 = PASS
