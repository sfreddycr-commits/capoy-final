# CAPOY — PM HANDOFF — USUARIOS INTERNOS V1

## Objetivo
Administrar accesos internos reales usando la tabla existente `admin_users`, sin crear un sistema paralelo de usuarios y sin exponer contraseñas.

## Base funcional esperada
Antes de desplegar, preservar el baseline QA actual:
- reservations = 8
- tours = 3
- customers = 7
- providers = 5
- fleet = 5
- reviews = 6
- CMS V1 = PASS

## Migración
**NO HAY MIGRACIÓN EN ESTA FASE.**
Usuarios V1 reutiliza `admin_users`, `admin_sessions` y `admin_audit_log` creadas por `0001_admin_auth.sql`.

## Ruta
- `/admin/usuarios`

## API
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`

## Seguridad / permisos
- Todas requieren sesión.
- Las tres requieren `role=owner`.
- Un usuario `admin` autenticado debe recibir `403` al intentar administrar usuarios.
- POST/PATCH mantienen protección same-origin; Origin externo debe devolver `403`.
- No existe DELETE. La baja se realiza con `status=inactive`.
- No se devuelve `password_hash` en ninguna respuesta.
- El propietario actual no puede quitarse su propio rol owner ni desactivarse.
- El sistema no permite dejar CAPOY sin al menos un owner activo.

## Roles V1
- `owner`
- `admin`

En V1 no se publican roles ficticios ni permisos granulares que todavía no existan. `admin` conserva el acceso administrativo general ya existente; `owner` agrega administración de usuarios internos.

## Contraseñas
- Alta: contraseña inicial obligatoria, mínimo 12 caracteres.
- Edición: contraseña opcional; vacía conserva la actual.
- Si cambia la contraseña de otro usuario, sus sesiones activas deben invalidarse.
- Las contraseñas se almacenan con scrypt + salt; nunca en texto plano.
- El PM no debe imprimir contraseñas QA en el reporte.

## QA API
1. `GET /api/admin/users` sin sesión -> 401.
2. Owner autenticado -> 200, summary + listado.
3. Confirmar que la respuesta no contiene `password_hash`, `token_hash` ni secretos.
4. Crear usuario admin QA válido -> 201.
5. Correo duplicado -> 409.
6. Correo inválido -> 400.
7. Nombre menor a 2 caracteres -> 400.
8. Rol no permitido -> 400.
9. Estado no permitido -> 400.
10. Contraseña inicial <12 -> 400.
11. PATCH válido -> 200.
12. PATCH ID inexistente con payload válido -> 404.
13. Intentar auto-desactivar al owner actual -> 400.
14. Intentar auto-demover owner actual a admin -> 400.
15. Si solo existe un owner activo, intentar dejarlo inactivo/demoverlo -> 400.
16. Origin malicioso en POST/PATCH -> 403.
17. Crear un segundo usuario owner QA si se desea probar la regla de último owner; al terminar puede dejarse inactivo, no borrar.
18. Cambiar contraseña de un usuario QA y verificar que sus sesiones previas queden invalidadas.
19. Usuario con role=admin autenticado: `GET/POST/PATCH /api/admin/users` -> 403.

## QA UI
Ruta `/admin/usuarios`:
- owner: carga KPIs y tabla real.
- KPIs: Total, Activos, Propietarios, Administradores.
- buscador por nombre/correo/rol.
- crear usuario.
- editar usuario.
- cambiar estado.
- cambiar rol.
- cambiar contraseña opcionalmente.
- desktop PASS.
- mobile PASS.
- admin no-owner: mensaje de acceso restringido, sin gestión de usuarios.

## Auditoría
Confirmar eventos:
- `admin_user_created`
- `admin_user_updated`

La metadata puede incluir IDs/rol/estado, pero nunca contraseñas ni hashes.

## Regresión obligatoria
Verificar sin modificar baseline previo:
- LANDING
- LOGIN
- AUTH
- DASHBOARD
- RESERVAS = 8
- TOURS = 3
- CLIENTES = 7
- PROVEEDORES = 5
- FLOTA = 5
- RESEÑAS = 6
- CMS
- USUARIOS
- LOGOUT
- HEALTH
- DATABASE

## Datos QA
Se permite crear usuarios internos QA para validar el módulo. Preferir dejarlos `inactive` al finalizar si no serán usados. No limpiar las entidades QA anteriores.

## SOURCE DRIFT
Esperado: `NONE`.

Si aparece un problema de implementación:
`DOCUMENTAR -> REPORTAR -> ESPERAR AL DEVELOPER`.

OpenCode no modifica código.

## Resultado esperado
`USUARIOS INTERNOS V1 = PASS`
