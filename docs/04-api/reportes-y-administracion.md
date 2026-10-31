# Reportes y administración

Todo este módulo es exclusivo de **empleados**.

## Reportes — `/api/reportes`

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/reportes/ventas-mensuales?anio=2026` | Pedidos y monto vendido por mes |
| GET | `/api/reportes/estado-existencias` | Inventario por variante y alertas de stock bajo |
| GET | `/api/reportes/productos-mas-vendidos?limite=10` | Ranking de productos |
| GET | `/api/reportes/movimientos-inventario` | Historial de entradas y salidas |

### Ventas mensuales

`anio` es opcional (por defecto el año actual). Solo cuenta pedidos `pagado` y `enviado`. Devuelve `{ anio, ventas_por_mes: [{ mes, cantidad_pedidos, total_vendido }] }`. Solo aparecen los meses con ventas, y los valores numéricos llegan como texto (el frontend los convierte y rellena con 0 los meses vacíos).

### Estado de existencias

Variantes activas de productos activos, ordenadas por stock ascendente. Devuelve `total_variantes`, `variantes_bajo_stock_minimo`, `detalle_bajo_minimo` (las que cumplen `stock <= stock_minimo`) e `inventario_completo`.

### Productos más vendidos

`limite` por defecto 10, entre 1 y 100. Agrupa por **producto** (suma todas sus variantes) y solo cuenta pedidos `pagado` y `enviado`. Devuelve `id_producto`, `nombre`, `unidades_vendidas` y `total_generado`.

### Movimientos de inventario

Filtros opcionales: `id_variante` o `id_producto` (todas las variantes del producto). Cada movimiento incluye la variante (`sku`, `talla`, `color`) y su producto. Los `motivo` más comunes: "reposición de proveedor", "venta", "cancelación de pedido", "expiración de reserva", "reembolso de pedido", y los que escribe el empleado en un ajuste manual.

## Empleados — `/api/empleados`

No existe registro público: solo un empleado autenticado puede crear a otro. Las respuestas incluyen el `usuario` asociado, sin contraseña.

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/empleados` | Crea usuario (tipo `empleado`) y perfil en una sola transacción |
| GET | `/api/empleados` | Lista |
| GET | `/api/empleados/:id` | Detalle |
| PUT | `/api/empleados/:id` | Edita `nombre`, `apellido`, `puesto`, `telefono`, `correo`, `salario`, `activo` |
| DELETE | `/api/empleados/:id` | Elimina el empleado |

**Cuerpo de creación**: `email` y `password` (mínimo 6 caracteres) son obligatorios; opcionales `nombre`, `apellido`, `puesto`, `telefono`, `correo`, `salario` (no negativo) y `fecha_contratacion`. Errores: `400` validación · `409` el correo ya existe.

> Un empleado que bloqueó o desbloqueó cuentas no se puede borrar (llave foránea `RESTRICT`); se desactiva con `PUT { "activo": false }`.

## Lista negra — `/api/lista-negra`

Bloqueo de cuentas de clientes como **sanción**. Es distinto de desactivar una cuenta: el bloqueado ve el mensaje "Esta cuenta ha sido bloqueada" (`CUENTA_BLOQUEADA`) y no se le revela el motivo.

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/lista-negra` | Bloquea una cuenta. Cuerpo: `{ "id_usuario": 12, "motivo": "..." }` |
| GET | `/api/lista-negra` | Bloqueos activos. `?activo=false` historial de desbloqueados; `?activo=todos` todos |
| DELETE | `/api/lista-negra/:id` | Desbloquea. El `:id` es el del bloqueo, no el del usuario |

Reglas:

- Solo se pueden bloquear cuentas de **clientes** (`400` si es un empleado).
- El motivo es obligatorio y tiene un tope de caracteres.
- Bloquear una cuenta ya bloqueada responde `409`.
- Si la cuenta estuvo bloqueada y se desbloqueó, un nuevo bloqueo **reactiva la misma fila** (el correo es único) con el nuevo motivo y empleado.
- Desbloquear no borra la fila: pone `activo = false` y guarda la fecha y el empleado que desbloqueó.
- Quien bloquea o desbloquea debe tener un perfil de empleado activo.
