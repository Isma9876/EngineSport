# 2. Instalación y ejecución

## Requisitos

| Herramienta | Versión |
| --- | --- |
| Node.js | 24 (LTS). Ambos repos tienen `engines`/`.nvmrc` con esta versión |
| npm | La que trae Node 24 |
| PostgreSQL | Una base accesible por red. El proyecto usa [Neon](https://neon.tech) con SSL |
| Cuenta de Stripe | En modo de prueba (claves `sk_test_...` y `pk_test_...`) |
| Git | Cualquier versión reciente |

Los dos repositorios deben estar clonados **uno junto al otro**:

```
UMG/
├── EngineSport/            ← backend y documentación
└── EngineSport-frontend/   ← frontend
```

> El seed `seed-productos-tanda1.js` lee las imágenes desde `../EngineSport-frontend/public/img/productos`, por eso la carpeta del frontend debe estar al lado.

## Backend

```bash
cd EngineSport
npm install
```

### Variables de entorno

El servidor carga `.env.production` si `NODE_ENV=production` y `.env.development` en cualquier otro caso (ver `server.js`). Copia la plantilla y complétala:

```bash
cp .env.example .env.development
```

| Variable | Descripción | Ejemplo / valor por defecto |
| --- | --- | --- |
| `NODE_ENV` | Ambiente | `development` |
| `PORT` | Puerto del servidor | `8081` |
| `DB_HOST` | Servidor de PostgreSQL | |
| `DB_USER` | Usuario de la base | |
| `DB_PASSWORD` | Contraseña de la base | |
| `DB_NAME` | Nombre de la base | |
| `DB_DIALECT` | Dialecto de Sequelize | `postgres` |
| `DB_SSL` | `true` si la base exige SSL (Neon lo exige) | `true` |
| `JWT_SECRET` | Secreto con el que se firman los tokens. Debe ser largo y aleatorio | |
| `JWT_EXPIRES_IN` | Vigencia del token | `1h` |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe (`sk_test_...`) | |
| `STRIPE_WEBHOOK_SECRET` | Secreto de firma del webhook (`whsec_...`) | |
| `RESERVA_MINUTOS` | Minutos que se reserva el stock de un pedido pendiente | `30` |
| `CRON_SECRET` | Secreto del encabezado `x-cron-secret` para el cron de expiración. Sin él, el endpoint siempre responde 401 | |
| `PEDIDO_TOTAL_MINIMO` | Total mínimo (con IVA) que debe quedar al aplicar un cupón | `150` |
| `ENVIO_COSTO` | Costo fijo de envío en quetzales | `35` |
| `ENVIO_GRATIS_DESDE` | Envío gratis si el subtotal (menos descuento) alcanza este monto. `0` = nunca | `500` |
| `CORS_ORIGINS` | Dominios permitidos, separados por coma y sin `/` final | `http://localhost:5173` |

> Los archivos `.env*` están en `.gitignore`. **Nunca se suben al repositorio.**

### Crear las tablas

Al arrancar, el servidor ejecuta `sequelize.sync()`, que **crea las tablas que no existan** (no modifica las existentes). Las migraciones de la carpeta `sql/` se usan cuando la base ya tiene datos; ver [Base de datos](03-base-de-datos.md#migraciones).

### Ejecutar

```bash
npm start
```

Debe imprimir `Servidor corriendo en el puerto 8081 [ambiente: development]`. Comprobaciones:

```bash
curl http://localhost:8081/health      # {"status":"ok"}
curl http://localhost:8081/            # {"message":"EngineSport API","ambiente":"development"}
```

### Cargar datos de prueba (seeds)

Los tres scripts son **idempotentes** (se pueden correr varias veces sin duplicar datos) y, antes de tocar nada, muestran el servidor de base de datos destino y piden escribir `si` para continuar.

| Orden | Script | Qué carga |
| --- | --- | --- |
| 1 | `node seed.js` | Categorías raíz, proveedores y productos de prueba con sus variantes |
| 2 | `node seed-catalogo-base.js` | Subcategorías (por ejemplo "Gorras", "Mochilas y bolsos") y proveedores base. Una sola transacción |
| 3 | `node seed-productos-tanda1.js` | 25 productos con variantes, stock inicial e imágenes. Requiere que existan las categorías y proveedores del paso anterior |

> Los seeds **no crean empleados**. Ver "Primer empleado" abajo.

### Primer empleado

El registro público solo crea clientes, y crear un empleado (`POST /api/empleados`) exige ser empleado. Por eso el **primer empleado debe insertarse directamente en la base de datos**: una fila en `usuarios` con `tipo = 'empleado'` y la contraseña en hash `bcrypt`, más su fila en `empleados` con el `id_usuario` correspondiente. Los siguientes se crean desde la API.

## Frontend

```bash
cd EngineSport-frontend
npm install
cp .env.example .env
```

| Variable | Descripción |
| --- | --- |
| `VITE_API_URL` | URL base de la API. En local: `http://localhost:8081` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clave **pública** de Stripe (`pk_test_...`). Nunca la secreta |

```bash
npm run dev       # servidor de desarrollo en http://localhost:5173
npm run build     # compila a la carpeta dist/
npm run preview   # sirve la compilación para revisarla
npm run lint      # revisa el código con oxlint
```

El puerto `5173` coincide con el valor por defecto de `CORS_ORIGINS`. Si usas otro puerto o dominio, agrégalo a esa variable.

## Probar los pagos en local

El webhook de Stripe necesita llegar a tu máquina. Con la [CLI de Stripe](https://docs.stripe.com/stripe-cli):

```bash
stripe listen --forward-to localhost:8081/api/pagos/webhook
```

Copia el `whsec_...` que imprime a `STRIPE_WEBHOOK_SECRET` y reinicia el backend. Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC. Más detalle en [Pagos con Stripe](07-pagos-stripe.md).

## Pruebas automatizadas

El proyecto **no incluye pruebas automatizadas** (`npm test` no está configurado en el backend y el frontend solo tiene `npm run lint`). Las pruebas se hacen manualmente con un cliente HTTP (por ejemplo Thunder Client o Postman) y con el propio frontend.

## Problemas frecuentes

| Síntoma | Causa probable |
| --- | --- |
| El navegador bloquea las peticiones (error de CORS) | El origen del frontend no está en `CORS_ORIGINS`, o tiene `/` al final |
| `Error al sincronizar la base de datos` | Credenciales de `DB_*` incorrectas, o falta `DB_SSL=true` en Neon |
| `Token inválido o expirado` constante | `JWT_SECRET` distinto entre reinicios o entre ambientes |
| El pedido nunca pasa a "pagado" | El webhook no está llegando: revisa `STRIPE_WEBHOOK_SECRET` y la URL del webhook |
| La primera petición tarda ~30 s en producción | El plan gratuito de Render duerme el servicio; ver [Despliegue](08-despliegue.md) |
| El stock de pedidos abandonados no se libera | Falta configurar el cron hacia `/api/pedidos/expirar` o falta `CRON_SECRET` |
