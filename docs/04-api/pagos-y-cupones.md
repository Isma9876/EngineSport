# Pagos y cupones

## Pagos — `/api/pagos`

El flujo completo con Stripe se explica en [Pagos con Stripe](../07-pagos-stripe.md). Aquí solo la referencia de endpoints.

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/api/pagos/intent` | Cliente dueño del pedido | Crea o reutiliza el PaymentIntent del pedido |
| GET | `/api/pagos` | Empleado | Lista todos los pagos, del más reciente al más antiguo |
| GET | `/api/pagos/pedido/:idPedido` | Empleado o dueño | Pago de un pedido |
| POST | `/api/pagos/webhook` | Webhook (firma de Stripe) | Recibe los eventos de Stripe |

### `POST /api/pagos/intent`

**Cuerpo**: `{ "id_pedido": 15 }`

**Respuesta `200`**

```json
{
  "client_secret": "pi_3Q..._secret_...",
  "payment_intent_id": "pi_3Q...",
  "id_pedido": 15,
  "monto": "295.06"
}
```

El frontend usa `client_secret` con Stripe.js para mostrar el formulario de tarjeta y confirmar el pago.

**Comportamiento**

- El pedido debe estar `pendiente` (si no, `400`).
- Hay **un solo PaymentIntent por pedido**. Si el pago falla, el cliente reintenta con el mismo `client_secret`.
- Si el total del pedido cambió, se actualiza el mismo intent. Si el intent estaba cancelado, se crea uno nuevo.
- Moneda: `gtq`. Método: tarjeta. El monto se envía en centavos.
- El intent lleva `metadata.id_pedido`, que es como el webhook sabe a qué pedido corresponde.
- Se usa una clave de idempotencia para que un doble clic no cree dos intents.
- Respuestas `409`: el pago ya fue recibido (el webhook marcará el pedido en unos segundos) o está en proceso.

### `POST /api/pagos/webhook`

Registrado en `server.js` **antes** de `express.json()` y con `express.raw()`, porque Stripe necesita el cuerpo crudo para verificar la firma. Una firma inválida responde `400`.

| Evento de Stripe | Efecto |
| --- | --- |
| `payment_intent.succeeded` | Pago `completado` (con `fecha_pago`) y pedido `pagado`. Es idempotente. Si el pedido ya estaba `cancelado`, se **reembolsa** el pago automáticamente |
| `payment_intent.payment_failed` | Pago `fallido`, solo si seguía `pendiente` y correspondía a ese intent. **No** devuelve stock |
| `payment_intent.canceled` | Igual que el anterior |

Si el procesamiento falla, responde `500` y Stripe reintenta el evento.

## Cupones — `/api/cupones`

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/api/cupones/validar` | Autenticado | Vista previa de un cupón sobre un subtotal |
| POST | `/api/cupones` | Empleado | Crea un cupón |
| GET | `/api/cupones` | Empleado | Lista (el más reciente primero) |
| GET | `/api/cupones/:id` | Empleado | Un cupón |
| PUT | `/api/cupones/:id` | Empleado | Edita un cupón |
| DELETE | `/api/cupones/:id` | Empleado | **Desactiva** el cupón (no se borra: los pedidos históricos lo referencian) |

### Datos de un cupón

| Campo | Tipo | Notas |
| --- | --- | --- |
| `codigo` | string | 3 a 50 caracteres: letras, números, `-` y `_`. Se guarda en mayúsculas y es único (`409` si se repite) |
| `descripcion` | string | Opcional, hasta 200 caracteres |
| `tipo` | string | `porcentaje` o `monto` |
| `valor` | número | Mayor que 0. Si es porcentaje, no mayor que 100 |
| `vigencia_inicio`, `vigencia_fin` | fecha | Opcionales. `vigencia_fin` debe ser posterior al inicio |
| `usos_maximos` | entero | Mayor que 0, o `null` para ilimitado |
| `monto_minimo` | número | Subtotal mínimo para usarlo. 0 por defecto |
| `activo` | booleano | |
| `usos_actuales` | entero | Lo maneja el sistema; no se edita a mano |

### `POST /api/cupones/validar`

**Cuerpo**: `{ "codigo": "VERANO10", "subtotal": 258 }`. **Respuesta**: `{ "codigo", "tipo", "valor", "descuento" }`. Es solo una vista previa; el cálculo real se repite al crear el pedido.

### Reglas de validación

Un cupón se rechaza (`400`, con mensaje) si:

1. No existe o está inactivo.
2. Aún no está vigente, o ya venció.
3. Alcanzó `usos_maximos`.
4. El subtotal es menor que `monto_minimo`.
5. El total final (con IVA, sin envío) quedaría por debajo de `PEDIDO_TOTAL_MINIMO` (Q150 por defecto).

El descuento es `subtotal × valor / 100` (porcentaje) o `valor` (monto fijo), y **nunca supera el subtotal**.

### Control de usos

- Al crear un pedido con cupón, la fila del cupón se bloquea y se suma un uso, para que `usos_maximos` no se exceda con pedidos simultáneos.
- Si el pedido se cancela, expira o se reembolsa, **se devuelve el uso**.
