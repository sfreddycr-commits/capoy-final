# PM — PROVIDERS V1

## Base

`94a878e3aeffe1ac634bc8808b6f2d9a1a4d001a`

## Objetivo

Agregar el módulo administrativo real de proveedores sin seeds ni datos inventados por código.

## Migración

Aplicar una vez:

`migrations/0006_providers.sql`

Crea la tabla `providers` con nombre comercial, razón social, contacto principal, correo, teléfono, país, tipo de servicio, estado, notas, trazabilidad de administrador y timestamps.

No insertar proveedores automáticamente.

## API

- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `PATCH /api/admin/providers/:id`

Todas requieren sesión; POST/PATCH exigen same-origin.

Estados válidos:

- `active`
- `inactive`

Tipos válidos:

- `tour_operator`
- `transport`
- `lodging`
- `guide`
- `activity`
- `restaurant`
- `other`

Reglas principales:

- nombre mínimo 2 caracteres
- correo válido cuando exista
- debe existir correo o teléfono
- nombre comercial único
- tipo y estado deben pertenecer a las listas permitidas

## Frontend

Ruta:

`/admin/proveedores`

Debe incluir:

- KPIs reales
- búsqueda
- filtro por estado
- filtro por tipo de servicio
- listado paginado
- alta
- edición
- responsive desktop/mobile
- cero filas ficticias desde frontend

## Dashboard

Después de migración, `providers` debe aparecer `available=true` y su contador debe coincidir con la tabla real.

## Auditoría

Confirmar eventos:

- `provider_created`
- `provider_updated`

## QA mínimo

1. Sin sesión: GET/POST → 401.
2. Origin externo en POST/PATCH → 403.
3. GET vacío después de migración → 200, total 0 si no se han creado datos QA.
4. Crear proveedor válido → 201.
5. Nombre duplicado → 409.
6. Email inválido → 400.
7. Sin email ni teléfono válido → 400.
8. Tipo inválido → 400.
9. Estado inválido → 400.
10. Editar existente → 200.
11. Editar ID inexistente con payload válido → 404.
12. Filtros `status`, `serviceType` y `q` funcionan.
13. Dashboard detecta `providers`.
14. Landing/login/auth/dashboard/reservas/tours/clientes continúan PASS.
15. Las reservas existentes no cambian.

## Regla operativa

OpenCode actúa como PM/operador. No modifica código. Si encuentra un defecto de código: DOCUMENTAR → REPORTAR → ESPERAR AL DEVELOPER.

## Resultado esperado

`PROVIDERS V1 = PASS`
