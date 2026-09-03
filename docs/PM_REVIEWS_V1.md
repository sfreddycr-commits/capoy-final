# PM — DEPLOY + QA REVIEWS V1

## Base
`dd6183186b3a27d77ca60c8d96da936fe5231e80`

## Objetivo
Cerrar el sexto módulo operativo detectado por el dashboard: `reviews`.

## Migración
Aplicar una vez:

`migrations/0008_reviews.sql`

Debe crear `reviews` con:
- `customer_id` nullable FK → `customers.id`, ON DELETE SET NULL
- `tour_id` nullable FK → `tours.id`, ON DELETE SET NULL
- autor, país, rating 1-5, título, comentario, fuente, estado, featured
- estados: pending / published / rejected
- fuentes: admin / google / tripadvisor / facebook / website / other
- sin seed automático

## API
- `GET /api/admin/reviews`
- `POST /api/admin/reviews`
- `PATCH /api/admin/reviews/:id`

### Seguridad
- sin sesión GET/POST/PATCH → 401
- Origin externo POST/PATCH → 403

### Validaciones
- autor < 2 → 400
- rating fuera de 1-5 → 400
- comentario < 5 caracteres → 400
- source inválido → 400
- status inválido → 400
- customerId inexistente → 400
- tourId inexistente → 400
- customerId/tourId vacíos son válidos y quedan NULL
- ID de reseña inexistente con payload válido → 404

### Listado
Debe incluir summary real:
- total
- pending
- published
- rejected
- averageRating
- featured

Filtros:
- status
- rating
- q

Búsqueda `q` por autor, país, título, comentario o nombre de tour.

## Frontend
Ruta:

`/admin/resenas`

Debe mostrar:
- KPIs reales
- búsqueda
- filtro de estado
- filtro por estrellas
- tabla real
- crear reseña
- editar reseña
- vínculo opcional con cliente activo
- vínculo opcional con tour publicado
- fuente
- estado de moderación
- reseña destacada
- desktop y mobile
- cero opiniones ficticias generadas por código

## Dashboard
Después de migrar `reviews` debe aparecer `available=true` y el dashboard debe quedar con los 6/6 módulos operativos detectados.

## Auditoría
Confirmar eventos:
- `review_created`
- `review_updated`

## Regresión
Verificar:
- landing
- login
- auth
- dashboard
- reservas
- tours
- clientes
- proveedores
- flota
- reseñas
- logout
- health/database

No modificar datos QA existentes fuera de los nuevos registros creados para probar Reviews V1.

## Source drift
Esperado: NO.

OpenCode no modifica código. Si detecta defecto de código: DOCUMENTAR → REPORTAR → ESPERAR AL DEVELOPER.

## Resultado esperado
`REVIEWS V1 = PASS`
