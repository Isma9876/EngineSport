# Catálogo

Incluye productos, variantes, categorías y proveedores.

## Productos — `/api/productos`

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/productos` | Opcional | Lista paginada con filtros. Una tarjeta por producto |
| GET | `/api/productos/filtros` | Opcional | Opciones disponibles para los filtros |
| GET | `/api/productos/:id` | Opcional | Detalle con todas sus variantes |
| POST | `/api/productos` | Empleado | Crea un producto con sus variantes |
| PUT | `/api/productos/:id` | Empleado | Edita datos del producto (no las variantes) |
| DELETE | `/api/productos/:id` | Empleado | Elimina el producto |

### Qué ve cada rol

| Dato | Visitante / cliente | Empleado |
| --- | --- | --- |
| Productos y variantes inactivos | No (responde `404`) | Sí |
| Disponibilidad | Campo `estado` (`disponible`, `pocas_unidades`, `agotado`) | `estado` y además stock exacto |
| `precio_costo`, `proveedor`, `activo` | No | Sí |

Una cuenta desactivada con token vigente se trata como visitante en estas rutas.

### `GET /api/productos` — parámetros

| Parámetro | Descripción |
| --- | --- |
| `page`, `limit` | Paginación. `limit` por defecto 12, máximo 50 |
| `q` | Búsqueda por nombre, sin distinguir mayúsculas ni acentos |
| `categoria` | Id de categoría. Incluye todas sus subcategorías |
| `marca` | Marca |
| `genero` | `hombre`, `mujer` o `unisex`. `hombre` y `mujer` también devuelven los `unisex` |
| `talla`, `color` | Productos con al menos una variante que cumpla **todas** las condiciones a la vez |
| `disponible` | `true` para solo productos con alguna variante con stock |
| `precio_min`, `precio_max` | Rango de precio de venta |
| `orden` | `nombre_asc` (por defecto), `nombre_desc`, `precio_asc`, `precio_desc` |

**Respuesta `200`**

```json
{
  "total": 25,
  "page": 1,
  "limit": 12,
  "total_pages": 3,
  "productos": [
    {
      "id": 4,
      "nombre": "Camiseta running",
      "marca": "Nike",
      "genero": "unisex",
      "precio_venta": "129.00",
      "categoria": { "id": 2, "nombre": "Ropa" },
      "imagen_url": "/img/productos/p04-negro.webp",
      "estado": "disponible"
    }
  ]
}
```

Para un empleado cada tarjeta añade `activo`, `precio_costo`, `proveedor`, `total_variantes` y `stock_total`. Un parámetro inválido responde `400` con el motivo.

### `GET /api/productos/filtros`

Devuelve `marcas`, `tallas` (ordenadas: numéricas y luego XS, S, M, L, XL...), `colores`, `generos` (solo los presentes), `precio_min` y `precio_max`.

### `GET /api/productos/:id`

Devuelve `id`, `nombre`, `descripcion`, `marca`, `genero`, `precio_venta`, `categoria`, el `estado` del producto y el arreglo `variantes`. Cada variante trae `id`, `sku`, `talla`, `color`, `imagen_url` y `estado`. El `id` de la variante es el que se usa para agregar al carrito y comprar. Para un empleado se añaden `stock`, `stock_minimo` y `activo` en cada variante, y `activo`, `precio_costo` y `proveedor` en el producto.

### `POST /api/productos`

**Cuerpo**

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `nombre` | string | Sí | |
| `descripcion` | string | No | |
| `marca` | string | No | |
| `precio_costo` | número | Sí | No negativo |
| `precio_venta` | número | Sí | **Mayor** que `precio_costo` |
| `genero` | string | No | `hombre`, `mujer`, `unisex` (por defecto `unisex`) |
| `id_categoria` | entero | No | Debe existir |
| `id_proveedor` | entero | No | Debe existir |
| `variantes` | arreglo | Sí | Al menos una |

Cada elemento de `variantes`:

| Campo | Obligatorio | Notas |
| --- | --- | --- |
| `sku` | Sí | Único en toda la base |
| `talla`, `color` | No | La combinación no puede repetirse dentro del producto |
| `imagen_url` | No | |
| `stock` | No | Entero ≥ 0 (0 por defecto). Si es > 0 se registra una entrada de inventario "reposición de proveedor" |
| `stock_minimo` | No | Entero ≥ 0. Umbral para el estado `pocas_unidades` |

El producto y sus variantes se guardan en una sola transacción: si algo falla, no se guarda nada. Respuesta `201` con el producto y sus variantes. Errores: `400` validación · `409` SKU duplicado.

### `PUT /api/productos/:id`

Acepta `nombre`, `descripcion`, `marca`, `precio_costo`, `precio_venta`, `genero`, `activo`, `id_categoria`, `id_proveedor`. Valida que el precio de venta siga siendo mayor que el costo, comparando con el valor nuevo o el existente.

### `DELETE /api/productos/:id`

Elimina el producto y sus variantes. Si alguna variante ya tiene ventas o movimientos de inventario responde `409` y sugiere desactivar el producto con `activo: false`.

## Variantes — `/api`

Todas son solo para empleados.

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/productos/:id/variantes` | Agrega una variante a un producto existente |
| PUT | `/api/variantes/:id` | Edita `sku`, `talla`, `color`, `imagen_url`, `stock_minimo`, `activo`. **No edita el stock** |
| DELETE | `/api/variantes/:id` | Elimina una variante que nunca se vendió y que no sea la última del producto |
| POST | `/api/variantes/:id/stock` | Ajuste manual de inventario |

### `POST /api/variantes/:id/stock`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `tipo_movimiento` | string | `entrada` o `salida` |
| `cantidad` | entero | Mayor que 0. Debe ser un número JSON, no texto |
| `motivo` | string | Obligatorio, máximo 150 caracteres |

La variante se bloquea, se actualiza el stock y se registra el movimiento en la misma transacción. Una salida que dejaría el stock negativo responde `409`.

Errores comunes de variantes: `409` SKU repetido, combinación talla/color repetida, intento de borrar la última variante de un producto, o una variante con ventas (se debe desactivar).

## Categorías — `/api/categorias`

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/categorias` | Público | Todas las categorías, con su padre y subcategorías |
| GET | `/api/categorias/:id` | Público | Una categoría |
| POST | `/api/categorias` | Empleado | Crea. Cuerpo: `nombre` (obligatorio), `descripcion`, `id_categoria_padre` |
| PUT | `/api/categorias/:id` | Empleado | Edita `nombre`, `descripcion`, `id_categoria_padre` |
| DELETE | `/api/categorias/:id` | Empleado | Elimina una categoría sin subcategorías ni productos |

Reglas: una categoría no puede ser su propio padre ni colgar de una de sus descendientes (evita ciclos). Borrar una con subcategorías o productos responde `409`.

## Proveedores — `/api/proveedores`

Todo el módulo es interno: solo empleados.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/proveedores` | Lista |
| GET | `/api/proveedores/:id` | Detalle |
| POST | `/api/proveedores` | Crea. Cuerpo: `nombre_empresa` (obligatorio), `contacto`, `telefono`, `email`, `direccion` |
| PUT | `/api/proveedores/:id` | Edita los mismos campos |
| DELETE | `/api/proveedores/:id` | Elimina uno sin productos asociados (si no, `409`) |
