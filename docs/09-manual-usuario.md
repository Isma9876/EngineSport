# 9. Manual de usuario

Guía para usar EngineSport, dividida por tipo de usuario.

- [Parte A. Cliente](#parte-a-cliente)
- [Parte B. Empleado (panel de administración)](#parte-b-empleado-panel-de-administración)

---

## Parte A. Cliente

### Registrarse e iniciar sesión

1. Pulsa **Crear cuenta** en la esquina superior.
2. Completa correo, contraseña (mínimo 6 caracteres) y, si quieres, nombre, apellido y teléfono.
3. Al terminar, ya tienes la sesión iniciada. La próxima vez usa **Ingresar** con tu correo y contraseña.

Si tu sesión vence (dura 1 hora), la página te avisará y te llevará a **Ingresar** de nuevo.

> Si ves "Esta cuenta ha sido bloqueada" o "Esta cuenta está desactivada", contacta a la tienda.

### Explorar el catálogo

En **Productos** puedes:

- **Buscar** por nombre (no importan las mayúsculas ni los acentos).
- **Filtrar** por categoría, marca, género, talla, color y rango de precio, o ver solo lo **disponible**.
- **Ordenar** por nombre o por precio.
- Pasar de página con la paginación.

Cada tarjeta muestra la etiqueta de disponibilidad: **Disponible**, **Pocas unidades** o **Agotado**. La tienda no muestra el número exacto de existencias.

### Ver un producto

Entra a la tarjeta para ver la descripción, el precio y las variantes. Elige **talla** y **color**; las combinaciones sin existencias aparecen como agotadas. Pulsa **Agregar al carrito** (necesitas haber iniciado sesión).

### Usar el carrito

En **Carrito** puedes cambiar cantidades, quitar productos o vaciar el carrito. Cada línea muestra su situación:

| Aviso | Qué significa | Qué hacer |
| --- | --- | --- |
| Disponible | Todo en orden | Nada |
| Stock insuficiente | Pediste más de lo que hay | Reduce la cantidad |
| Agotado | Ya no hay existencias | Quítalo |
| No disponible | El producto se retiró de la tienda | Quítalo |
| El precio cambió (antes Q...) | El precio es distinto al de cuando lo agregaste | Revisa el nuevo precio |

No puedes pasar al pago mientras haya líneas con aviso.

**Cupón de descuento**: escribe el código y aplícalo. Verás el descuento y el nuevo total. Si el cupón no es válido (vencido, agotado, monto mínimo no alcanzado...) se te explica el motivo.

**Cómo se calcula el total**: subtotal − descuento + IVA (12 %) + envío. El envío cuesta Q35 y es **gratis** desde Q500 de compra (después del descuento).

### Pagar

1. En el carrito pulsa **Continuar al pago**.
2. **Elige tu dirección de envío**, o agrega una nueva.
3. Pulsa **Pagar** y escribe los datos de tu tarjeta en el formulario seguro de Stripe. Si tu banco lo pide, confirma con 3D Secure.
4. Espera en la pantalla de confirmación unos segundos: la tienda aguarda el aviso del banco y luego marca tu pedido como **pagado**.
5. Descarga tu **comprobante en PDF**.

Importante:

- Al iniciar el pago, los productos quedan **reservados para ti durante 30 minutos**. Si no pagas en ese tiempo, el pedido se cancela y las unidades se liberan.
- Si pulsas **Cancelar y volver**, el pedido se cancela y se libera la reserva.
- Si el pago falla, puedes intentarlo de nuevo con la misma tarjeta u otra.

### Mis pedidos

En **Mis pedidos** ves tu historial, con filtro por estado:

| Estado | Significado |
| --- | --- |
| Pendiente | Esperando tu pago |
| Pagado | Pago recibido; la tienda prepara el envío |
| Enviado | En camino. Verás la paquetería y el número de guía |
| Cancelado | Cancelado, vencido o reembolsado |

Desde aquí puedes **descargar el comprobante** (pedidos pagados o enviados) y **cancelar** un pedido que siga pendiente. Un pedido ya pagado no se cancela desde aquí: contacta a la tienda para solicitar el reembolso.

### Mi cuenta

- **Mis datos**: edita nombre, apellido y teléfono.
- **Mis direcciones**: agrega, edita o elimina direcciones. Siempre hay una **predeterminada**: para cambiarla, marca otra como predeterminada.
- **Desactivar mi cuenta**: te pide tu contraseña. Tu historial se conserva, pero ya no podrás iniciar sesión. Para reactivarla, contacta a la tienda.

---

## Parte B. Empleado (panel de administración)

Los empleados inician sesión con el mismo formulario. En el menú de usuario aparece **Panel de administración**. Las cuentas de empleado las crea otro empleado; no hay registro público.

### Inicio

Resume la situación del negocio:

- Indicadores y **gráfico de ventas** del año.
- **Requiere atención**, ordenado por prioridad: pedidos pagados listos para enviar, variantes agotadas, variantes con pocas unidades, cupones por vencer y cupones casi agotados. Cada aviso lleva a la pantalla correspondiente.

### Productos

Muestra todos los productos, **incluidos los inactivos**, con stock exacto, costo y proveedor.

- **Crear un producto**: nombre, marca, descripción, género, categoría, proveedor, precio de costo y precio de venta (**debe ser mayor** que el costo) y **al menos una variante**.
- **Editar** los datos del producto o **desactivarlo** (deja de verse en la tienda pero conserva su historial).
- **Eliminar**: solo si nunca se vendió ni tuvo movimientos. Si no, el sistema sugiere desactivarlo.

**Variantes** (panel de cada producto). Una variante es una combinación de talla y color con su propio SKU y stock.

- Crear una variante: SKU único, talla, color, imagen, stock inicial y **stock mínimo** (cuando el stock baja a ese número, la tienda muestra "Pocas unidades").
- **Ajustar el stock**: elige *entrada* o *salida*, la cantidad y el **motivo** (obligatorio). Queda registrado en el historial de movimientos. No se puede sacar más de lo que hay.
- Editar o desactivar una variante. El stock **no** se edita directamente: siempre se ajusta con un movimiento.
- Eliminar una variante: solo si nunca se vendió y no es la última del producto.

### Categorías

Crea, edita y elimina categorías. Pueden tener **subcategorías** (elige la categoría padre). No se puede eliminar una categoría que tenga subcategorías o productos.

### Proveedores

Crea, edita y elimina proveedores (empresa, contacto, teléfono, correo y dirección). No se puede eliminar uno con productos asociados.

### Pedidos

Lista de todos los pedidos con su estado. Acciones según el estado:

| Estado | Acciones |
| --- | --- |
| Pendiente | **Cancelar pedido** (libera el stock y el cupón) |
| Pagado | **Marcar como enviado** (indica paquetería y número de guía; ambos juntos o ninguno) · **Reembolsar** (devuelve el dinero por Stripe, devuelve el stock y cancela el pedido) |
| Enviado | Consultar. Ya no admite cancelar ni reembolsar |
| Cancelado | Consultar |

El detalle muestra las líneas, la dirección y los datos del pago, y permite descargar el comprobante.

### Cupones

Crea cupones de **porcentaje** (hasta 100 %) o de **monto fijo**, con código único (3 a 50 caracteres: letras, números, `-` y `_`), vigencia, usos máximos y monto mínimo de compra. Los cupones **no se borran**: se desactivan, porque los pedidos antiguos los referencian.

### Reportes

| Reporte | Contenido |
| --- | --- |
| Ventas mensuales | Pedidos y monto vendido por mes, para el año elegido |
| Productos más vendidos | Ranking por unidades, sumando todas las variantes |
| Estado de existencias | Inventario completo y alertas de stock bajo el mínimo |
| Movimientos de inventario | Historial de entradas y salidas, con su motivo |

Los reportes se pueden exportar a CSV. Solo cuentan los pedidos pagados o enviados.

### Funciones solo disponibles por API

El panel no incluye pantallas para **crear empleados**, **gestionar clientes** (listar, desactivar, reactivar) ni la **lista negra** (bloquear y desbloquear cuentas). Estas funciones se usan directamente con la API; ver [Referencia de la API](04-api/README.md).

---

## Preguntas frecuentes

**¿Por qué mi pedido sigue "pendiente" después de pagar?**
La tienda espera el aviso de Stripe. Normalmente tarda unos segundos; la pantalla de confirmación lo consulta durante aproximadamente un minuto.

**¿Qué pasa si pago justo cuando venció la reserva?**
El sistema detecta que el pedido ya estaba cancelado y te **reembolsa automáticamente**.

**¿Por qué no veo cuántas unidades quedan?**
Por diseño, los clientes solo ven si hay existencias (Disponible, Pocas unidades o Agotado).

**La página tardó mucho en cargar la primera vez.**
El servidor gratuito se duerme cuando no hay uso; la primera petición lo despierta y puede tardar unos 30 segundos.
