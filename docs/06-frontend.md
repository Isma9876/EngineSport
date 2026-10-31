# 6. Frontend

Aplicación de una sola página (SPA) en **React 19** con **Vite**, **React Router 7** y **Tailwind CSS v4**. JavaScript (sin TypeScript). Repositorio: `EngineSport-frontend`. Los textos de la interfaz están en español.

## Estructura de carpetas

```
EngineSport-frontend/
├── index.html
├── vite.config.js
├── public/img/                  ← imágenes (hero, categorías, productos .webp) y logo
└── src/
    ├── main.jsx                 ← BrowserRouter + AuthProvider + App
    ├── App.jsx                  ← definición de rutas
    ├── api.js                   ← ÚNICO cliente HTTP hacia la API
    ├── index.css                ← Tailwind y tokens de diseño (@theme)
    ├── context/AuthContext.jsx  ← sesión
    ├── hooks/                   ← useApi, useContadorCarrito, useMediaQuery
    ├── utils/                   ← formato, carrito, csv, stripeAppearance
    ├── components/              ← piezas compartidas
    └── pages/
        ├── Home.jsx
        ├── auth/                ← Login, Registro
        ├── catalogo/            ← Productos, ProductoDetalle
        ├── ventas/              ← Carrito, Checkout, PagoStripe, Confirmacion, MisPedidos
        ├── cuenta/              ← MiCuenta
        └── admin/               ← panel de empleados
```

## Rutas

| Ruta | Página | Acceso |
| --- | --- | --- |
| `/` | Inicio: categorías y productos destacados | Público |
| `/login`, `/registro` | Autenticación | Público |
| `/productos` | Catálogo con filtros, búsqueda, orden y paginación | Público |
| `/productos/:id` | Detalle con selección de talla y color | Público |
| `/carrito` | Carrito | Cliente |
| `/checkout` | Dirección de envío y pago | Cliente |
| `/confirmacion/:id` | Resultado del pago y comprobante | Cliente |
| `/mis-pedidos` | Historial de pedidos | Cliente |
| `/mi-cuenta` | Datos personales, direcciones y desactivar cuenta | Cliente |
| `/admin` | Resumen del negocio | Empleado |
| `/admin/productos` | Productos y variantes | Empleado |
| `/admin/categorias` | Categorías | Empleado |
| `/admin/proveedores` | Proveedores | Empleado |
| `/admin/pedidos` | Pedidos: envío y reembolso | Empleado |
| `/admin/cupones` | Cupones | Empleado |
| `/admin/reportes` | Reportes (se carga bajo demanda con `lazy`) | Empleado |

`RutaProtegida` redirige a `/login` si no hay sesión, y a `/` si el tipo de usuario no corresponde.

### Funciones que solo existen en la API

El panel de administración **no tiene pantallas** para gestionar empleados, clientes ni la lista negra: esas funciones están disponibles únicamente a través de la API (`/api/empleados`, `/api/clientes`, `/api/lista-negra`).

## Sesión (`AuthContext`)

- `AuthProvider` envuelve toda la app. Expone `useAuth()` → `{ token, usuario, cliente, login, registrar, logout, aviso }`.
- La sesión se guarda en `localStorage` con las claves `token`, `usuario` y `cliente`, y se restaura de forma síncrona al abrir la página.
- Una sesión de cliente sin `cliente.id` se descarta, porque sin él no se puede comprar.
- Al vencer la sesión, `api.js` avisa a `AuthContext`, que borra la sesión, muestra un aviso y manda a `/login`.

## Cliente HTTP (`api.js`)

**Nadie usa `fetch` directamente.** `api.js` exporta `get`, `post`, `put`, `delete` y `descargar` (para PDF, devuelve un `Blob`).

- Agrega `Authorization: Bearer <token>` automáticamente.
- Los errores se lanzan como `{ status, message, code }`. Un fallo de red es `{ status: 0, code: "RED" }`.
- Ante `401` (salvo en el login y en eliminar cuenta, donde significa contraseña incorrecta) o `403 CUENTA_DESACTIVADA`, cierra la sesión.
- Tras cada llamada a `/api/carrito` emite el evento `carrito:cambio`, que `useContadorCarrito` escucha para actualizar el número del encabezado sin pedirlo de nuevo.
- No importa React, para poder usarse desde cualquier módulo.

## Hooks

| Hook | Uso |
| --- | --- |
| `useApi(ruta)` | `GET` con estados. Devuelve `{ datos, error, cargando, recargar }`. Con `ruta = null` no pide nada. Ignora respuestas de peticiones anteriores si la ruta cambió |
| `useContadorCarrito(idCliente)` | Unidades en el carrito, siempre al día |
| `useMediaQuery(consulta)` | Diseño adaptable según el ancho |

## Componentes compartidos

| Componente | Descripción |
| --- | --- |
| `Layout` | Encabezado (menú, carrito con contador, cuenta), pie y `<Outlet />` |
| `RutaProtegida` | Protege rutas por tipo de usuario |
| `Cargando` | Indicador de carga. Obligatorio en toda página que pide datos |
| `TarjetaProducto`, `ImagenProducto`, `EtiquetaEstado` | Catálogo y disponibilidad |
| `RangoPrecio` | Filtro de precio |
| `SelectorDireccion`, `FormularioDireccion` | Direcciones en checkout y cuenta |
| `PasosCompra` | Indicador de pasos del proceso de compra |
| `MenuAcciones` | Menú de acciones por fila en tablas de administración |

## Reglas del equipo

Documentadas en `CLAUDE.md` y `README.md` del repositorio del frontend:

1. Toda llamada a la API pasa por `src/api.js`.
2. El token vive en `localStorage` (clave `token`), y la sesión se maneja con `useAuth()`.
3. **Prohibido** `dangerouslySetInnerHTML`.
4. Los `DECIMAL` llegan como texto: `Number()` para operar, `formatoPrecio()` para mostrar.
5. La disponibilidad se muestra con el campo `estado`, **nunca** con el stock exacto.
6. Al comprar se envía el `id` de la **variante**.
7. Toda página que pide datos muestra `<Cargando />` y maneja el error. El backend gratuito de Render tarda en despertar.
8. Colores y tipografías se definen una sola vez, en el bloque `@theme` de `src/index.css`.
9. En archivos compartidos (`App.jsx`, `Layout.jsx`) solo se agregan líneas propias, con cambios mínimos.
10. No subir `.env` ni claves. Solo la clave **pública** de Stripe.
11. Ramas `feature/...`, Pull Requests pequeños y revisión de otra persona antes de integrar a `main`.

## Diseño

Los tokens están en `@theme` de `src/index.css` (Tailwind v4 no usa `tailwind.config`):

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-primario` | `#3ddc97` | Botones y acentos |
| `--color-primario-oscuro` | `#16784f` | Hover |
| `--color-secundario` | `#0f3d2e` | Texto sobre primario, fondos oscuros |
| `--color-superficie` | `#f1f7f4` | Fondos suaves |
| `--color-estado-*` | verde, ámbar, gris, rojo | Disponible, pocas unidades, agotado, error |
| `--font-sans` | Inter | Texto |
| `--font-titulo` | Barlow Condensed | Títulos |

Las clases se usan como `bg-primario`, `text-texto-suave`, `font-titulo`, etc.

## Flujo de compra en el frontend

1. **Producto**: el cliente elige talla y color; se agrega el `id` de la variante con `POST /api/carrito/items`.
2. **Carrito**: muestra el aviso de cada línea (`agotado`, `stock_insuficiente`...) y permite aplicar un cupón (`?cupon=`). Con líneas con problema no se puede avanzar.
3. **Checkout**: el cliente elige dirección. Al pulsar pagar se crea el pedido (`POST /api/pedidos`) y luego el intento de pago (`POST /api/pagos/intent`). Se muestra el formulario de Stripe (`PaymentElement`). "Cancelar y volver" cancela el pedido pendiente.
4. **Pago**: `stripe.confirmPayment` con 3D Secure si hace falta.
5. **Confirmación**: consulta `GET /api/pedidos/:id` cada 2 s, hasta 30 intentos (~60 s), esperando que el webhook lo pase a `pagado`. Entonces limpia del carrito las variantes compradas y ofrece descargar el comprobante PDF.

## Panel de administración

| Pantalla | Qué ofrece |
| --- | --- |
| Inicio | Resumen, gráfico de ventas del año y lista "Requiere atención": pedidos pagados por enviar, variantes agotadas o con pocas unidades, cupones por vencer o por agotarse |
| Productos | Listado con filtros, alta, edición, activar/desactivar, eliminación y **panel de variantes** (alta, edición, ajuste de stock con motivo, eliminación) |
| Categorías, Proveedores | CRUD |
| Pedidos | Listado, detalle, marcar como enviado (con transportista y guía), cancelar y reembolsar |
| Cupones | Alta, edición y desactivación |
| Reportes | Ventas mensuales, productos más vendidos, existencias y movimientos de inventario, con exportación a CSV |

El menú lateral se define en `src/pages/admin/menu.js`: cada persona agrega solo su línea.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (puerto 5173) |
| `npm run build` | Compila a `dist/` |
| `npm run preview` | Sirve la compilación |
| `npm run lint` | Revisa el código con `oxlint` |
