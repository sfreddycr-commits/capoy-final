# PM HANDOFF — CONFIGURACIÓN V1

## SHA
Usar el SHA final indicado por Developer. Base: `b6644047452e159ed99f0e301a98055b462f552e`.

## Rol del PM
OpenCode inspecciona, despliega, aplica migración y prueba. NO modifica código. Ante fallo: DOCUMENTAR → REPORTAR → ESPERAR.

## Migración
Aplicar UNA VEZ `migrations/0010_app_settings.sql`.
Crea `app_settings` con 8 ajustes operativos iniciales. No contiene secretos.

## Baseline a preservar
- reservations=8
- tours=3
- customers=7
- providers=5
- fleet=5
- reviews=6
- cms_settings=13 según baseline PM
- admin_users=2 (1 owner activo + 1 admin QA inactivo)

## Ruta
`/admin/configuracion`

## API
- GET `/api/admin/settings`: cualquier usuario autenticado; devuelve `editable`.
- PATCH `/api/admin/settings`: solo owner.

## Ajustes V1
- business_name
- timezone
- default_currency (USD/CRC)
- default_language (es/en)
- booking_email
- booking_phone
- reservation_prefix
- maintenance_mode

Nunca guardar aquí DB passwords, API keys, tokens, cookies, SMTP passwords u otros secretos.

## QA
1. Build PASS, health 200/database ok.
2. Migración: tabla, PK/FK e índices correctos; 8 keys presentes.
3. Sin sesión: GET/PATCH → 401.
4. Owner: GET → 200 editable=true; PATCH válido → 200.
5. Admin: GET → 200 editable=false; PATCH → 403.
6. Origin malicioso PATCH → 403 sin cambio BD.
7. Validaciones 400: key desconocida, timezone inválida, currency inválida, language inválido, email inválido, phone inválido, prefix inválido, maintenance_mode inválido, payload vacío.
8. Cambiar temporalmente `reservation_prefix` CAP→QA-CAP y restaurar CAP. Confirmar persistencia tras refresh y sin redeploy.
9. Cambiar temporalmente currency USD→CRC y restaurar USD.
10. Audit: `settings_updated`, metadata solo keys; nunca valores sensibles.
11. UI desktop/mobile: campos reales, owner editable, admin read-only.
12. Regresión completa landing/login/dashboard/reservas/tours/clientes/proveedores/flota/reseñas/CMS/usuarios/logout.
13. Baseline exacto preservado.
14. SOURCE_DRIFT=NONE.

## Nota sobre maintenance_mode
En V1 el valor se administra y persiste, pero NO bloquea todavía el sitio público. No afirmar que activa una pantalla de mantenimiento. Esa conducta requeriría una fase explícita posterior.

## Cierre esperado
CONFIGURACIÓN V1 = PASS
