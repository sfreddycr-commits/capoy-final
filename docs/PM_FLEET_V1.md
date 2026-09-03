# FLEET V1 — PM QA HANDOFF

## Base
`a8dd78e6c339642b2d7df766a4a333d007c26798`

## Scope
Nuevo módulo administrativo `/admin/flota` con datos reales desde MySQL.

### DB
Aplicar una vez `migrations/0007_fleet.sql`.
Crea tabla `fleet` sin seeds, con placa única, nombre operativo, tipo, marca/modelo/año, capacidad, estado, notas y auditoría administrativa.

### Estados
- active
- maintenance
- inactive

### Tipos
- car
- suv
- van
- minibus
- bus
- boat
- other

### API
- GET `/api/admin/fleet`
- POST `/api/admin/fleet`
- PATCH `/api/admin/fleet/:id`

Todas requieren sesión; POST/PATCH además deben respetar same-origin.

### QA mínimo
1. Sin sesión GET/POST/PATCH → 401.
2. Origin externo en POST/PATCH → 403.
3. Crear vehículo válido → 201.
4. Placa duplicada → 409.
5. Tipo inválido → 400.
6. Estado inválido → 400.
7. Capacidad 0 o >500 → 400.
8. Año fuera de 1950-2100 → 400.
9. PATCH válido → 200.
10. PATCH ID inexistente con payload válido → 404.
11. Filtros `status`, `vehicleType`, `q`.
12. Dashboard debe detectar `fleet` como available=true y contador real.
13. Auditoría: `fleet_created`, `fleet_updated`.
14. Desktop/mobile de `/admin/flota`.
15. Regresión: landing, login, auth, dashboard, reservas, tours, clientes, proveedores, logout, health y DB.

### Notas
- No se enlaza todavía Flota → Proveedor, Tour o Reserva.
- No borrar datos QA anteriores.
- Si hay defecto de código: DOCUMENTAR → REPORTAR → ESPERAR AL DEVELOPER.
- OpenCode no modifica source code.

## Resultado esperado
`FLEET V1 = PASS`
