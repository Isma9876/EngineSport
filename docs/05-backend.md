# 5. Backend

API REST en **Node.js 24 + Express 5**, con **Sequelize** sobre **PostgreSQL**. Estilo CommonJS (`require`).

## Estructura de carpetas

```
EngineSport/
├── server.js                    ← arranque: CORS, webhook, rutas, /health
├── seed.js                      ← datos de prueba (categorías, proveedores, productos)
├── seed-catalogo-base.js        ← subcategorías y proveedores base
├── seed-productos-tanda1.js     ← 25 productos con variantes e imágenes
├── sql/                         ← migraciones SQL manuales
├── docs/                        ← esta documentación
└── app/
    ├── config/db.config.js      ← lectura de variables DB_*
    ├── models/                  ← un archivo por tabla + index.js con las relaciones
    ├── routes/                  ← un archivo por módulo
    ├── middlewares/             ← authJwt.js y pedidoAuth.js
    ├── controllers/             ← lógica de cada endpoint
    └── services/                ← lógica compartida
```

## Arranque (`server.js`)

El orden importa:

1. Carga de variables: `.env.production` si `NODE_ENV=production`, si no `.env.development`.
2. **CORS** restringido a `CORS_ORIGINS`. Las peticiones sin cabecera `Origin` (curl, Thunder Client, el webhook de Stripe) pasan.
3. **Webhook de Stripe** (`POST /api/pagos/webhook`) con `express.raw()`. Va **antes** de `express.json()` porque Stripe necesita el cuerpo sin procesar para verificar la firma.
4. `express.json()` para el resto.
5. `sequelize.sync()`: crea las tablas que falten (no altera las existentes).
6. Registro de las rutas de los 14 módulos.
7. `GET /health` y `GET /`.
8. `app.listen` en `PORT` (8081 por defecto).

## Autenticación y autorización

Código en `app/middlewares/authJwt.js`. Se encadenan en las rutas, por ejemplo:

```js
router.post("/", [verifyToken, isEmpleado], productos.create);
```

| Middleware | Función |
| --- | --- |
| `verifyToken` | Exige `Authorization: Bearer <token>`, verifica la firma y la vigencia, y revisa en la base que la cuenta no esté desactivada. Deja `req.usuario = { id, email, tipo }` |
| `verifyTokenOptional` | Para rutas públicas que muestran más datos a quien tiene sesión. Sin encabezado, continúa como visitante. Con token inválido responde `401`. Con cuenta desactivada, la trata como visitante |
| `isEmpleado` | Exige `tipo = empleado` |
| `isCliente` | Exige `tipo = cliente` |
| `isEmpleadoODueno(fn)` | Deja pasar a cualquier empleado, o al cliente cuyo `id_usuario` coincida con el que devuelve `fn(req)`. Si `fn` devuelve `null`, responde `404` |

Las funciones `fn` están en `app/middlewares/pedidoAuth.js` (dueño de un pedido, de un cliente en la ruta o de un cliente en el cuerpo) y en los controladores de clientes y direcciones.

> `verifyToken` consulta la tabla del perfil en cada petición. Es deliberado: un token vigente no debe seguir funcionando si la cuenta se desactivó después de emitirlo.

## Servicios

Lógica de negocio reutilizable por varios controladores (`app/services`).

| Servicio | Responsabilidad |
| --- | --- |
| `totales.service.js` | `calcularTotales({ subtotal, descuento })` → base, impuestos (12 %), envío y total. Única fuente de la fórmula |
| `cupon.service.js` | `validarYCalcular(...)`: valida un cupón y calcula el descuento. Bloquea la fila del cupón cuando recibe una transacción. Lanza `CuponError`. También exporta `round2` |
| `inventario.service.js` | `registrarStockInicial` (entrada de inventario al crear variantes) y `ajustarStock` (ajuste manual con bloqueo y movimiento). Lanza `ErrorInventario` |
| `reserva.service.js` | `cancelarPedidoPendiente`, `expirarPedidosVencidos` y `reembolsarPedidoPagado`. Coordina Stripe, stock, cupón y estados |

## Transacciones y concurrencia

Toda operación que toca varias tablas corre en una **transacción**: si algo falla, no queda nada a medias. Para evitar sobreventa:

- Se bloquea la fila de cada variante con `LOCK.UPDATE` antes de leer su stock.
- Las variantes se procesan **siempre en orden ascendente de id**, igual en crear pedido, cancelar y reembolsar, para que dos pedidos simultáneos no se bloqueen mutuamente (deadlock).
- El orden de bloqueo es siempre variantes → cupón.
- Operaciones con Stripe y base de datos: en el reembolso se llama primero a Stripe (si falla, no se toca la base); al cancelar, primero se cancela el intent para que el cliente no pueda pagar mientras se libera el stock.

## Reserva de stock

Al crear un pedido el stock se descuenta de inmediato (reserva). Si no se paga en `RESERVA_MINUTOS` (30 por defecto):

1. Un cron externo llama a `POST /api/pedidos/expirar`, **o**
2. Cualquier `POST /api/pedidos` libera antes las reservas vencidas, antes de validar stock.

Cada pedido expirado: cancela el PaymentIntent en Stripe (razón `abandoned`), devuelve el stock con un movimiento "expiración de reserva", devuelve el uso del cupón y marca el pago como `fallido`.

## Convenciones del código

- **Nombres en español** para tablas, campos, rutas y mensajes.
- **Validar antes de consultar**: los ids de la URL se validan como enteros positivos; así un valor como `abc` da `400` y no un `500` que expone el error de la base.
- **Texto limpio**: `cleanText` recorta espacios sobrantes y convierte vacío en `null`.
- **Borrado lógico**: se prefiere `activo = false` a borrar filas con historial.
- **Respuestas de error** siempre con `message`; `code` cuando el frontend debe distinguir el caso.
- **No exponer errores internos** en `500` en las rutas nuevas.
- **Imports de modelos** vía `db.<nombre>` desde `app/models/index.js`, nunca directo.

## Agregar un endpoint nuevo

1. Si hace falta una tabla: crear `app/models/<nombre>.model.js`, registrarlo en `app/models/index.js` con sus relaciones y, si la base ya existe, escribir un script en `sql/`.
2. Crear la función en `app/controllers/<modulo>.controller.js`.
3. Registrar la ruta en `app/routes/<modulo>.route.js` con los middlewares de permisos adecuados.
4. Si es un módulo nuevo, añadir su `require("./app/routes/...")(app)` en `server.js`.
5. Documentarlo en [`docs/04-api`](04-api/README.md).

## Dependencias principales

| Paquete | Uso |
| --- | --- |
| `express` | Servidor HTTP |
| `sequelize`, `pg`, `pg-hstore` | ORM y driver de PostgreSQL |
| `jsonwebtoken` | Tokens JWT |
| `bcryptjs` | Hash de contraseñas |
| `stripe` | Pagos, reembolsos y verificación del webhook |
| `pdfkit` | Comprobante de pago en PDF |
| `cors` | Control de orígenes |
| `dotenv` | Variables de entorno |
| `body-parser` | Declarado como dependencia; el servidor usa `express.json()` |
