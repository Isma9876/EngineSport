# EngineSport

EngineSport es una tienda en línea de artículos y ropa deportiva. Es el proyecto final del curso de Desarrollo Web (UMG). Permite a los clientes explorar un catálogo, armar un carrito y pagar con tarjeta. Permite al personal de la tienda administrar productos, inventario, pedidos, cupones y ver reportes de ventas.

El sistema se compone de **dos repositorios hermanos**:

| Repositorio | Contenido | Tecnologías |
| --- | --- | --- |
| `EngineSport` | API REST (backend) y esta documentación | Node.js 24, Express 5, Sequelize, PostgreSQL, JWT, Stripe |
| `EngineSport-frontend` | Aplicación web (frontend) | React 19, Vite, React Router, Tailwind CSS v4, Stripe.js, Recharts |

Toda la documentación vive en este repositorio (carpeta `docs/`), porque es el que contiene la API y la base de datos.

## Cómo leer esta documentación

| Si quieres... | Ve a |
| --- | --- |
| Entender cómo encaja todo | [1. Arquitectura](01-arquitectura.md) |
| Levantar el proyecto en tu máquina | [2. Instalación y ejecución](02-instalacion.md) |
| Conocer las tablas y relaciones | [3. Base de datos](03-base-de-datos.md) |
| Consumir o probar la API | [4. Referencia de la API](04-api/README.md) |
| Modificar el servidor | [5. Backend](05-backend.md) |
| Modificar la interfaz | [6. Frontend](06-frontend.md) |
| Entender cómo se cobra | [7. Pagos con Stripe](07-pagos-stripe.md) |
| Publicar el sistema | [8. Despliegue](08-despliegue.md) |
| Usar la tienda o el panel de administración | [9. Manual de usuario](09-manual-usuario.md) |
| Ver el alcance formal del sistema | [10. Requerimientos](10-requerimientos.md), [11. Casos de uso](11-casos-de-uso.md) y [12. Diagramas UML](12-diagramas-uml.md) |

## Resumen funcional

- **Cliente**: se registra, explora el catálogo con filtros, ve el detalle con tallas y colores, usa el carrito, aplica cupones, paga con tarjeta (Stripe), descarga su comprobante en PDF, consulta y cancela sus pedidos, y administra sus datos y direcciones.
- **Empleado**: accede a un panel de administración con resumen del negocio, gestión de productos y variantes, ajuste de inventario, categorías, proveedores, cupones, pedidos (envío y reembolso) y reportes.

## Convenciones de esta documentación

- Los nombres de rutas, campos, tablas y variables van en `código`.
- Las rutas de la API se escriben con el prefijo `/api`.
- La moneda es el quetzal (GTQ, `Q`) y el IVA aplicado es del 12 %.
- Los diagramas están escritos en [Mermaid](https://mermaid.js.org/). GitHub los muestra directamente; en GitBook hay que activar la integración de Mermaid (ver [Despliegue](08-despliegue.md#publicar-esta-documentación-en-gitbook)).
