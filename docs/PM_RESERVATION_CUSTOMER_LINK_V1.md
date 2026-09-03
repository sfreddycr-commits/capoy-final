# PM QA — RESERVATION CUSTOMER LINK V1

Base: `1f7f097cd5fd8787fc3de8296b92fc6a3eff42dc`

## Migración

Aplicar una vez:

`migrations/0005_reservation_customer_link.sql`

Debe agregar `reservations.customer_id` nullable, índice y FK a `customers(id)` con `ON DELETE SET NULL`.

No hacer backfill de las 6 reservas existentes.

## API clientes

- `GET /api/admin/customers/options` requiere sesión.
- Solo devuelve clientes `active`.
- Validar que `language="esp"` sea rechazado con 400 y `language="es"` sea aceptado.

## Crear nueva reserva

`POST /api/admin/reservations` ahora requiere:

- `customerId` de cliente activo
- `tourId` de tour publicado
- fecha y pasajeros válidos

El backend debe ignorar cualquier `customerName`, `customerEmail` o `customerPhone` enviado por el cliente HTTP y tomar esos datos exclusivamente de `customers`.

La nueva reserva debe guardar:

- `customer_id`
- snapshot `customer_name`
- snapshot `customer_email`
- snapshot `customer_phone`
- `tour_id`
- snapshot `tour_name`

Cliente inexistente o inactive: 400.
Tour inexistente/draft/inactive: 400.

## Snapshot

Crear una reserva con un cliente activo. Después cambiar nombre/correo/teléfono del cliente.

La reserva debe conservar los datos originales en sus campos snapshot, mientras `customer_id` sigue apuntando al cliente actualizado.

## Históricas

Las 6 reservas previas deben permanecer con `customer_id = NULL` y sus snapshots originales intactos.

El listado debe devolver:

- `customerId`
- `customerLinked`
- `currentCustomerStatus`

El frontend debe mostrar `Cliente vinculado` o `Reserva histórica`.

## Regresión

Verificar landing, login, auth, dashboard, clientes, tours, reservas, logout y health.

No modificar código desde OpenCode. Ante fallo de código: DOCUMENTAR → REPORTAR → ESPERAR AL DEVELOPER.

Resultado esperado: `RESERVATION CUSTOMER LINK V1 = PASS`.
