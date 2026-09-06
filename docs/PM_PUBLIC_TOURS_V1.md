# CAPOY — PM HANDOFF — TOURS PÚBLICOS V1

## Objetivo

Conectar la sección pública de tours de la landing con la tabla real `tours` administrada desde `/admin/tours`.

La fuente de verdad en operación normal pasa a ser MySQL: solamente tours con `status='published'` deben mostrarse públicamente.

## Base autorizada

`8c295ab8724b17cf12837b420139f2ba78c673cf`

## Migración

NO HAY MIGRACIÓN.

Se reutiliza la tabla `tours` existente.

## Cambios funcionales

### API pública

`GET /api/public/tours`

- No requiere sesión.
- Devuelve solamente tours publicados.
- No expone campos administrativos internos.
- Ordena por publicación más reciente y luego por ID descendente.
- Campos públicos: id, slug, name, destination, shortDescription, duration, adultPrice, childPrice, currency, capacity, mainImageUrl, publishedAt.

### Landing

`PublicToursBridge` consulta `/api/public/tours` y reemplaza las tarjetas temporales por los tours publicados reales.

- Un tour publicado aparece en la landing.
- Un tour draft NO aparece.
- Un tour inactive NO aparece.
- Cambios de nombre, destino, descripción corta, duración, precio, moneda e imagen se reflejan después de refrescar la landing, sin rebuild ni redeploy.
- Si no existen tours publicados, la landing muestra un estado vacío y NO conserva tarjetas falsas.
- Si la API pública está temporalmente caída, se conserva el contenido visual previo como degradación para no romper la landing; este fallback no sustituye la fuente de verdad cuando la API responde correctamente.

## QA obligatorio

1. Confirmar HEAD/origin/main = SHA autorizado del handoff final.
2. `git status` sin source drift.
3. Build PASS.
4. Deploy exacto PASS.
5. `/api/health` 200 + database ok.
6. `GET /api/public/tours` sin cookie debe devolver 200.
7. Confirmar que el total y nombres corresponden únicamente a tours `published`.
8. Confirmar que la respuesta pública NO expone created_by_admin_id, updated_by_admin_id ni datos de sesión/auditoría.
9. En `/admin/tours`, cambiar temporalmente un campo visible de un tour publicado (por ejemplo nombre o precio), guardar, refrescar landing y confirmar reflejo inmediato. Restaurar el valor original.
10. Cambiar temporalmente un tour publicado a `draft`: debe desaparecer de la landing tras refrescar. Restaurar a `published`.
11. Cambiar temporalmente un tour publicado a `inactive`: debe desaparecer de la landing tras refrescar. Restaurar a `published`.
12. Si es posible sin destruir baseline, comprobar escenario de 0 publicados y confirmar mensaje vacío. Restaurar todos los estados originales.
13. Verificar desktop y móvil.
14. Verificar que Landing, Auth y los 10 módulos administrativos existentes siguen operativos.
15. No limpiar datos QA.
16. SOURCE_DRIFT esperado: NONE.

## Seguridad

El endpoint público es read-only.

NO crear POST/PATCH/DELETE públicos.

La modificación de tours continúa exclusivamente por las rutas administrativas autenticadas existentes.

## Criterio de cierre

TOURS PÚBLICOS V1 = PASS cuando:

- API pública funciona sin autenticación.
- solo publicados son visibles.
- admin → landing refleja cambios reales sin deploy.
- draft/inactive desaparecen públicamente.
- no hay regresiones.
- SOURCE_DRIFT = NONE.

Ante un problema de código: DOCUMENTAR → REPORTAR → ESPERAR AL DEVELOPER. El PM no modifica source code.
