# CAPOY — Reservas V1

Base autorizada: `6174977bca0bf081f0513fea827d98364395e0c1`

## Alcance

- Tabla normalizada `reservations`.
- Listado autenticado con búsqueda, filtro de estado y paginación.
- KPIs reales: total, nuevas, confirmadas y próximas.
- Alta manual de reserva/solicitud.
- Cambio de estado de una reserva.
- Auditoría de creación y actualización.
- Responsive desktop, tablet y móvil.
- Sin datos simulados.

## API

- `GET /api/admin/reservations`
- `POST /api/admin/reservations`
- `PATCH /api/admin/reservations/:id`

Todos los endpoints requieren sesión administrativa. POST/PATCH conservan validación same-origin.

## Migración

Aplicar `migrations/0002_reservations.sql` una sola vez antes del QA funcional.

## Estados

`new`, `contacted`, `quoted`, `confirmed`, `completed`, `cancelled`.

## Regresión

`src/App.tsx`, `src/styles.css`, autenticación y dashboard existente no deben alterarse funcionalmente.
