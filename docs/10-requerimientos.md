# 10. Requerimientos

Requerimientos del sistema, reconstruidos a partir de lo implementado. Cada uno indica el módulo y su prioridad (**Alta**: sin esto el sistema no cumple su propósito; **Media**: necesaria para operar con comodidad; **Baja**: mejora).

## Actores

| Actor | Descripción |
| --- | --- |
| Visitante | Persona sin sesión que explora la tienda |
| Cliente | Usuario registrado que compra |
| Empleado | Personal de la tienda que administra el sistema |
| Stripe | Sistema externo que procesa los pagos |
| Cron | Servicio externo que dispara tareas periódicas |

## Requerimientos funcionales

### Cuentas y acceso

| ID | Requerimiento | Prioridad |
| --- | --- | --- |
| RF-01 | El sistema permitirá a un visitante registrarse como cliente con correo y contraseña (mínimo 6 caracteres) | Alta |
| RF-02 | El sistema no permitirá registrar dos cuentas con el mismo correo, sin distinguir mayúsculas | Alta |
| RF-03 | El sistema permitirá iniciar sesión a clientes y empleados y entregará un token con vigencia limitada | Alta |
| RF-04 | El sistema permitirá a un empleado crear cuentas de empleado; no habrá registro público de empleados | Alta |
| RF-05 | El sistema permitirá al cliente consultar y editar su nombre, apellido y teléfono | Media |
| RF-06 | El sistema permitirá al cliente administrar sus direcciones de envío, con una sola predeterminada | Alta |
| RF-07 | El sistema permitirá al cliente desactivar su propia cuenta confirmando su contraseña | Media |
| RF-08 | El sistema permitirá a un empleado listar, desactivar y reactivar cuentas de clientes | Media |
| RF-09 | El sistema permitirá a un empleado bloquear y desbloquear cuentas de clientes (lista negra), con motivo e historial | Media |
| RF-10 | El sistema impedirá el acceso a cuentas desactivadas o bloqueadas, incluso con un token emitido antes | Alta |

### Catálogo

| ID | Requerimiento | Prioridad |
| --- | --- | --- |
| RF-11 | El sistema mostrará el catálogo a cualquier visitante, con paginación | Alta |
| RF-12 | El sistema permitirá buscar productos por nombre ignorando mayúsculas y acentos | Alta |
| RF-13 | El sistema permitirá filtrar por categoría (incluyendo subcategorías), marca, género, talla, color, rango de precio y disponibilidad, y ordenar por nombre o precio | Alta |
| RF-14 | El sistema mostrará el detalle de un producto con sus variantes (talla, color, imagen) | Alta |
| RF-15 | El sistema mostrará la disponibilidad como `disponible`, `pocas_unidades` o `agotado`, sin revelar el stock exacto a clientes ni visitantes | Alta |
| RF-16 | El sistema ofrecerá las opciones de filtro disponibles (marcas, tallas, colores, géneros, rango de precio) | Media |
| RF-17 | El sistema organizará los productos en categorías jerárquicas | Media |

### Gestión de catálogo (empleados)

| ID | Requerimiento | Prioridad |
| --- | --- | --- |
| RF-18 | El sistema permitirá a un empleado crear productos con al menos una variante, en una sola operación atómica | Alta |
| RF-19 | El sistema exigirá que el precio de venta sea mayor que el precio de costo | Alta |
| RF-20 | El sistema permitirá editar, desactivar y eliminar productos; no eliminará los que tengan ventas o movimientos | Alta |
| RF-21 | El sistema permitirá agregar, editar, desactivar y eliminar variantes, con SKU único y sin repetir talla y color dentro de un producto | Alta |
| RF-22 | El sistema permitirá ajustar el stock con entradas y salidas, exigiendo un motivo y sin permitir stock negativo | Alta |
| RF-23 | El sistema registrará cada cambio de stock como un movimiento de inventario | Alta |
| RF-24 | El sistema permitirá administrar categorías y proveedores, sin eliminar los que tengan datos asociados | Media |
| RF-25 | El sistema mostrará a los empleados costo, proveedor, stock exacto y productos inactivos | Media |

### Carrito y compra

| ID | Requerimiento | Prioridad |
| --- | --- | --- |
| RF-26 | El sistema dará a cada cliente un carrito persistente para agregar, cambiar cantidad, quitar y vaciar | Alta |
| RF-27 | El sistema indicará en cada línea del carrito si está disponible, sin stock suficiente, agotada o no disponible, y si el precio cambió | Alta |
| RF-28 | El sistema calculará subtotal, descuento, IVA, envío y total siempre en el servidor | Alta |
| RF-29 | El sistema permitirá aplicar un cupón y mostrar su efecto antes de pagar | Media |
| RF-30 | El sistema creará pedidos con las líneas, la dirección de envío y los totales, reservando el stock | Alta |
| RF-31 | El sistema usará el precio de venta vigente y nunca el que envíe el cliente | Alta |
| RF-32 | El sistema impedirá vender más unidades que el stock, incluso con compras simultáneas | Alta |
| RF-33 | El sistema liberará el stock de los pedidos pendientes no pagados tras un tiempo configurable (30 minutos por defecto) | Alta |

### Pagos

| ID | Requerimiento | Prioridad |
| --- | --- | --- |
| RF-34 | El sistema permitirá pagar un pedido con tarjeta mediante Stripe | Alta |
| RF-35 | El sistema marcará el pedido como pagado solo al recibir la confirmación firmada de Stripe | Alta |
| RF-36 | El sistema permitirá reintentar un pago fallido sin crear un cobro nuevo | Alta |
| RF-37 | El sistema reembolsará automáticamente un pago recibido sobre un pedido que ya había sido cancelado | Media |
| RF-38 | El sistema permitirá a un empleado reembolsar un pedido pagado que no se ha enviado, devolviendo el stock | Media |
| RF-39 | El sistema generará un comprobante de pago en PDF para pedidos pagados o enviados | Media |

### Cupones

| ID | Requerimiento | Prioridad |
| --- | --- | --- |
| RF-40 | El sistema permitirá a un empleado crear, editar y desactivar cupones de porcentaje o monto fijo | Media |
| RF-41 | El sistema validará vigencia, usos máximos, monto mínimo y total mínimo resultante de cada cupón | Media |
| RF-42 | El sistema devolverá el uso de un cupón cuando el pedido se cancele, expire o se reembolse | Media |

### Pedidos

| ID | Requerimiento | Prioridad |
| --- | --- | --- |
| RF-43 | El sistema permitirá al cliente ver su historial de pedidos, filtrar por estado y descargar comprobantes | Alta |
| RF-44 | El sistema permitirá al cliente cancelar un pedido pendiente | Alta |
| RF-45 | El sistema permitirá a un empleado ver todos los pedidos, marcar uno pagado como enviado (con transportista y guía) y cancelar pedidos pendientes | Alta |
| RF-46 | El sistema impedirá que un cliente acceda a pedidos, pagos, direcciones o carritos de otros clientes | Alta |

### Reportes

| ID | Requerimiento | Prioridad |
| --- | --- | --- |
| RF-47 | El sistema mostrará las ventas por mes de un año | Media |
| RF-48 | El sistema mostrará los productos más vendidos | Media |
| RF-49 | El sistema mostrará el estado de existencias y las variantes bajo el stock mínimo | Media |
| RF-50 | El sistema mostrará el historial de movimientos de inventario por variante o producto | Media |
| RF-51 | El sistema mostrará a los empleados un resumen con los asuntos que requieren atención | Baja |
| RF-52 | El sistema permitirá exportar los reportes a CSV | Baja |

## Reglas de negocio

| ID | Regla |
| --- | --- |
| RN-01 | El IVA es del 12 % y se calcula sobre el subtotal menos el descuento. El envío no lleva IVA |
| RN-02 | El envío cuesta Q35 y es gratis cuando el subtotal menos el descuento llega a Q500 (valores configurables) |
| RN-03 | Un pedido sin cupón no tiene monto mínimo. Con cupón, el total con IVA no puede quedar por debajo de Q150 (configurable) |
| RN-04 | El descuento de un cupón nunca supera el subtotal |
| RN-05 | Un pedido pasa por `pendiente` → `pagado` → `enviado`, o a `cancelado`. `cancelado` es terminal |
| RN-06 | El estado `pagado` solo lo asigna el webhook de Stripe; nunca se establece a mano |
| RN-07 | Un cliente solo puede cancelar pedidos `pendiente`. Un pedido pagado se cancela únicamente mediante reembolso |
| RN-08 | El stock vive en la variante, no en el producto |
| RN-09 | Un producto debe conservar siempre al menos una variante |
| RN-10 | Las entidades con historial se desactivan, no se borran |
| RN-11 | Cada cliente tiene exactamente una dirección predeterminada |
| RN-12 | Una cuenta bloqueada o desactivada no puede iniciar sesión; el bloqueo no revela el motivo |
| RN-13 | Una variante que ya se vendió no se puede eliminar, solo desactivar |
| RN-14 | Un pedido guarda el precio unitario del momento de la compra |

## Requerimientos no funcionales

| ID | Categoría | Requerimiento |
| --- | --- | --- |
| RNF-01 | Seguridad | Las contraseñas se almacenan con hash `bcrypt`; nunca se devuelven |
| RNF-02 | Seguridad | La autenticación usa JWT firmado, con vigencia configurable (1 h por defecto) |
| RNF-03 | Seguridad | La autorización se valida en el servidor para cada ruta, por rol y por propiedad del recurso |
| RNF-04 | Seguridad | Los datos de tarjeta no pasan por el servidor propio; los procesa Stripe |
| RNF-05 | Seguridad | CORS limitado a los dominios autorizados; el webhook y el cron se autentican con secretos |
| RNF-06 | Seguridad | Las credenciales y claves se manejan por variables de entorno y no se suben al repositorio |
| RNF-07 | Integridad | Las operaciones que afectan varias tablas son atómicas (transacciones) |
| RNF-08 | Integridad | Las operaciones críticas son idempotentes (webhook, creación de intents, reembolsos) |
| RNF-09 | Rendimiento | El catálogo se pagina (máx. 50 por página) y el historial de pedidos también |
| RNF-10 | Disponibilidad | Existe un endpoint de salud (`/health`) que no consulta la base de datos |
| RNF-11 | Usabilidad | La interfaz está en español, con indicadores de carga y manejo de errores en cada pantalla |
| RNF-12 | Usabilidad | La interfaz se adapta a pantallas de distintos tamaños |
| RNF-13 | Compatibilidad | Funciona en navegadores modernos; requiere Node.js 24 para ejecutarse |
| RNF-14 | Mantenibilidad | Código organizado por capas (rutas, controladores, servicios, modelos) y un único cliente HTTP en el frontend |
| RNF-15 | Mantenibilidad | Los cambios al esquema se versionan en scripts SQL |
| RNF-16 | Localización | Moneda en quetzales (GTQ) y fechas en formato local `es-GT` |

## Alcance excluido

Lo que el sistema **no** hace actualmente:

- Pagos distintos a tarjeta (efectivo, transferencia, contra entrega).
- Recuperación de contraseña por correo y verificación de correo electrónico.
- Notificaciones por correo o mensajes al cliente.
- Pruebas automatizadas.
- Pantallas de administración para empleados, clientes y lista negra (solo existen en la API).
- Seguimiento del envío más allá de registrar transportista y número de guía.
- Devoluciones parciales: el reembolso es siempre del pedido completo.
