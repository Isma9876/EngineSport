# Autenticación y usuarios

## Autenticación — `/api/auth`

### `POST /api/auth/register` — Registro de cliente

Acceso: Público. Siempre crea un usuario de tipo `cliente` junto con su perfil, en una sola transacción. Los empleados no se auto-registran.

**Cuerpo**

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `email` | string | Sí | Se guarda en minúsculas y sin espacios |
| `password` | string | Sí | Mínimo 6 caracteres |
| `nombre` | string | No | |
| `apellido` | string | No | |
| `telefono` | string | No | |

**Respuesta `201`**

```json
{
  "message": "Registro exitoso.",
  "token": "eyJhbGciOi...",
  "usuario": { "id": 12, "email": "ana@correo.com", "tipo": "cliente" },
  "cliente": { "id": 7, "nombre": "Ana", "apellido": "López", "telefono": "5555-1234", "activo": true }
}
```

**Errores**: `400` faltan datos o contraseña corta · `409` el correo ya existe (el mensaje cambia si pertenece a una cuenta desactivada).

### `POST /api/auth/login` — Inicio de sesión

Acceso: Público. Sirve para clientes y empleados.

**Cuerpo**: `{ "email": "...", "password": "..." }`

**Respuesta `200`**

```json
{
  "message": "Login exitoso.",
  "token": "eyJhbGciOi...",
  "usuario": { "id": 12, "email": "ana@correo.com", "tipo": "cliente" },
  "cliente": { "id": 7, "nombre": "Ana", "apellido": "López" }
}
```

Para un empleado, en lugar de `cliente` viene `empleado: { id, nombre, apellido, puesto }`. Nunca se devuelven salario, teléfono ni contraseña.

**Errores**: `400` faltan datos · `401` credenciales inválidas (mensaje genérico) · `403 CUENTA_BLOQUEADA` · `403 CUENTA_DESACTIVADA`. El bloqueo y la desactivación solo se revelan **después** de validar la contraseña.

## Clientes — `/api/clientes`

La creación de clientes ocurre en `/api/auth/register`, no aquí.

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/clientes` | Empleado | Lista clientes. Por defecto solo activos. `?activo=false` solo desactivados; `?activo=todos` todos |
| GET | `/api/clientes/:id` | Empleado o dueño | Perfil del cliente (incluye `usuario` sin contraseña). `:id` es el `id` del cliente |
| PUT | `/api/clientes/:id` | Empleado o dueño | Actualiza `nombre`, `apellido`, `telefono`. Solo un empleado puede enviar `activo` (para reactivar con `{ "activo": true }`) |
| DELETE | `/api/clientes/:id` | Empleado | **Desactiva** la cuenta (`activo = false`). No borra datos; es reversible |
| POST | `/api/clientes/me/eliminar-cuenta` | Cliente | El propio cliente desactiva su cuenta. Cuerpo: `{ "password": "..." }` |

Mientras una cuenta está desactivada: el login responde `403` y el correo queda reservado (no se puede volver a registrar). `eliminar-cuenta` usa `POST` y no `DELETE` porque algunos clientes HTTP descartan el cuerpo en un `DELETE`.

## Direcciones — `/api/direcciones`

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/api/direcciones` | Autenticado | Crea una dirección. Un cliente solo puede crearla para sí mismo; un empleado para cualquiera |
| GET | `/api/direcciones/cliente/:id_cliente` | Empleado o dueño | Direcciones del cliente, de las más antiguas a las más nuevas |
| GET | `/api/direcciones/:id` | Empleado o dueño | Una dirección |
| PUT | `/api/direcciones/:id` | Empleado o dueño | Edita `direccion`, `ciudad`, `estado`, `codigo_postal`, `pais`, `es_predeterminada` |
| DELETE | `/api/direcciones/:id` | Empleado o dueño | Elimina la dirección |

**Cuerpo de creación**

| Campo | Tipo | Obligatorio |
| --- | --- | --- |
| `id_cliente` | entero | Sí |
| `direccion` | string | Sí |
| `ciudad`, `estado`, `codigo_postal`, `pais` | string | No |
| `es_predeterminada` | booleano (`true`/`false` reales, no texto) | No |

**Reglas de la dirección predeterminada**

- La primera dirección del cliente es predeterminada automáticamente.
- Marcar otra como `es_predeterminada: true` desmarca la anterior.
- No se puede poner `es_predeterminada: false` sobre la predeterminada actual (`400`): hay que marcar **otra** como predeterminada, para que el cliente nunca se quede sin una.
- Al eliminar la predeterminada, la dirección más antigua que quede pasa a serlo.
- `id_cliente` no se puede cambiar al editar, para que nadie mueva una dirección a otro cliente.
