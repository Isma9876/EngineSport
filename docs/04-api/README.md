# 4. Referencia de la API

API REST en JSON. Todas las rutas cuelgan de `/api`, salvo las de utilidad (`/` y `/health`).

| Ambiente | URL base |
| --- | --- |
| Local | `http://localhost:8081` |
| Producción | La URL del servicio en Render (variable `VITE_API_URL` del frontend) |

## Índice por módulo

| Módulo | Prefijo | Documento |
| --- | --- | --- |
| Autenticación | `/api/auth` | [Autenticación y usuarios](autenticacion-y-usuarios.md) |
| Clientes y direcciones | `/api/clientes`, `/api/direcciones` | [Autenticación y usuarios](autenticacion-y-usuarios.md) |
| Productos, variantes, categorías, proveedores | `/api/productos`, `/api/variantes`, `/api/categorias`, `/api/proveedores` | [Catálogo](catalogo.md) |
| Carrito y pedidos | `/api/carrito`, `/api/pedidos` | [Carrito y pedidos](carrito-y-pedidos.md) |
| Pagos y cupones | `/api/pagos`, `/api/cupones` | [Pagos y cupones](pagos-y-cupones.md) |
| Reportes, empleados y lista negra | `/api/reportes`, `/api/empleados`, `/api/lista-negra` | [Reportes y administración](reportes-y-administracion.md) |

## Autenticación

Las rutas protegidas exigen el encabezado:

```
Authorization: Bearer <token>
```

El token se obtiene en `POST /api/auth/login` o `POST /api/auth/register`. Contiene `id` (de `usuarios`), `email` y `tipo`. Vence según `JWT_EXPIRES_IN` (1 h por defecto).

## Leyenda de permisos

En las tablas de endpoints, la columna **Acceso** usa estos valores:

| Valor | Significado |
| --- | --- |
| Público | No requiere token |
| Opcional | El token es opcional; con un token de empleado la respuesta trae más datos |
| Autenticado | Cualquier usuario con token válido |
| Cliente | Solo `tipo = cliente` |
| Empleado | Solo `tipo = empleado` |
| Empleado o dueño | Un empleado, o el cliente propietario del recurso |
| Cron | Se autentica con el encabezado `x-cron-secret` |
| Webhook | Se autentica con la firma de Stripe |

## Formato de errores

Todos los errores devuelven JSON con un campo `message` legible. Algunos añaden un `code` para que el frontend distinga el caso sin depender del texto.

```json
{ "message": "Token inválido o expirado.", "code": "TOKEN_EXPIRADO" }
```

| Código HTTP | Cuándo |
| --- | --- |
| `200` / `201` | Éxito / recurso creado |
| `400` | Datos faltantes o inválidos |
| `401` | Sin token, token inválido o vencido, credenciales incorrectas |
| `403` | Sin permiso, cuenta desactivada o bloqueada |
| `404` | El recurso no existe (o no es visible para ese usuario) |
| `409` | Conflicto: duplicado, o el recurso tiene datos asociados y no se puede borrar |
| `500` | Error interno |

Valores de `code`:

| `code` | HTTP | Significado |
| --- | --- | --- |
| `TOKEN_EXPIRADO` | 401 | El token venció |
| `TOKEN_INVALIDO` | 401 | El token está alterado o mal formado |
| `CUENTA_DESACTIVADA` | 403 | La cuenta tiene `activo = false` |
| `CUENTA_BLOQUEADA` | 403 | La cuenta está en la lista negra |

> El frontend cierra la sesión automáticamente ante un `401` (salvo en el login) o un `403` con `CUENTA_DESACTIVADA`.

## Convenciones

- **Importes**: los `DECIMAL` se devuelven como texto (`"150.00"`). Convertir con `Number()` antes de operar.
- **Fechas**: ISO 8601 en UTC.
- **Paginación**: `page` (desde 1) y `limit`. Las respuestas paginadas incluyen el total de elementos y de páginas.
- **Borrado**: la mayoría de las entidades se **desactivan** (`activo = false`) en lugar de borrarse.
- **Cuerpo**: `Content-Type: application/json`, salvo el webhook de Stripe, que recibe el cuerpo crudo.

## Utilidades

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/` | Público | `{ "message": "EngineSport API", "ambiente": "development" }` |
| GET | `/health` | Público | `{ "status": "ok" }`. No toca la base de datos; lo usa el pinger para mantener despierto el servicio |
