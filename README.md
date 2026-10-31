# EngineSport (backend)

API REST de EngineSport, tienda de artículos y ropa deportiva. Proyecto final de Desarrollo Web, UMG. El frontend vive en el repositorio hermano `EngineSport-frontend`.

**Stack:** Node.js 24, Express 5, Sequelize, PostgreSQL, JWT, Stripe.

## Inicio rápido

```bash
npm install
cp .env.example .env.development   # completar los valores
npm start                          # http://localhost:8081
```

Comprobación: `GET http://localhost:8081/health` → `{"status":"ok"}`.

Datos de prueba (cada script pide confirmar la base de datos destino):

```bash
node seed.js
node seed-catalogo-base.js
node seed-productos-tanda1.js
```

## Documentación

Toda la documentación del proyecto (backend y frontend) está en [`docs/`](docs/README.md):

| Documento | Contenido |
| --- | --- |
| [Introducción](docs/README.md) | Qué es el sistema y cómo leer la documentación |
| [Arquitectura](docs/01-arquitectura.md) | Componentes, capas, roles y seguridad |
| [Instalación](docs/02-instalacion.md) | Requisitos, variables de entorno y ejecución |
| [Base de datos](docs/03-base-de-datos.md) | Diagrama entidad-relación, tablas y migraciones |
| [Referencia de la API](docs/04-api/README.md) | Todos los endpoints |
| [Backend](docs/05-backend.md) | Estructura, middlewares, servicios y convenciones |
| [Frontend](docs/06-frontend.md) | Rutas, sesión, cliente HTTP y panel de administración |
| [Pagos con Stripe](docs/07-pagos-stripe.md) | Flujo de cobro, webhook y reembolsos |
| [Despliegue](docs/08-despliegue.md) | Render, Neon, cron y GitBook |
| [Manual de usuario](docs/09-manual-usuario.md) | Guía para clientes y empleados |
| [Requerimientos](docs/10-requerimientos.md), [Casos de uso](docs/11-casos-de-uso.md), [UML](docs/12-diagramas-uml.md) | Documentación formal |

## Estructura

```
app/
  config/        conexión a la base de datos
  models/        modelos Sequelize y relaciones
  routes/        un archivo por módulo
  middlewares/   JWT y permisos
  controllers/   lógica de cada endpoint
  services/      totales, cupones, inventario y reservas
sql/             migraciones manuales
docs/            documentación
server.js        arranque
```

## Flujo de trabajo

Cada cambio va en una rama `feature/...` o `fix/...` y se integra a `main` con Pull Request revisado por otra persona. Los archivos `.env*` nunca se suben al repositorio.
