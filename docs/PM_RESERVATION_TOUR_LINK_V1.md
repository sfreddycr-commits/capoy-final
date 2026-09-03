# PM QA — RESERVATION → TOUR LINK V1

Base esperada: `0253b97d89109c85f07cd972ccbe26fe282a3bb3`.

## Objetivo

Las reservas nuevas deben seleccionar un tour publicado real por `tour_id`. El backend toma del catálogo el nombre, moneda y precios y conserva `tour_name` como snapshot histórico. Las reservas anteriores con `tour_id = NULL` deben permanecer intactas.

## No hay migración nueva

La columna y FK `reservations.tour_id` ya fueron creadas por `0003_tours.sql`.

## QA

1. Confirmar que las reservas existentes mantienen `tour_id = NULL` y su `tour_name` original.
2. Confirmar que `/api/admin/tours/options` solo entrega tours publicados.
3. Crear una reserva nueva desde `/admin/reservas` seleccionando un tour publicado.
4. Verificar que la nueva reserva guarda `tour_id` correcto y `tour_name` como snapshot del nombre actual.
5. Dejar el monto vacío y comprobar cálculo automático: adulto_price * adultos + (child_price o adult_price) * niños.
6. Verificar que un `tourId` inexistente, draft o inactive devuelve 400.
7. Confirmar que enviar `tourName` manual no sustituye la selección del tour real.
8. Cambiar después el nombre del tour y confirmar que la reserva conserva su `tour_name` histórico.
9. Verificar búsqueda, actualización de estado y listado de reservas.
10. Regresión: landing, login, auth, dashboard, tours, reservas, logout y health.

Resultado esperado: `RESERVATION TOUR LINK V1 = PASS`.
