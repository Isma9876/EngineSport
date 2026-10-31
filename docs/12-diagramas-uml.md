# 12. Diagramas UML

Todos los diagramas están en [Mermaid](https://mermaid.js.org/). Los casos de uso están en [11. Casos de uso](11-casos-de-uso.md); el modelo entidad-relación, en [3. Base de datos](03-base-de-datos.md#diagrama-entidad-relación); y los estados de un pedido, en [Carrito y pedidos](04-api/carrito-y-pedidos.md#ciclo-de-vida-de-un-pedido).

## Índice

1. [Diagrama de clases del dominio](#1-diagrama-de-clases-del-dominio)
2. [Diagramas de secuencia](#2-diagramas-de-secuencia)
3. [Diagramas de estado](#3-diagramas-de-estado)
4. [Diagrama de actividades: compra](#4-diagrama-de-actividades-compra)
5. [Diagrama de componentes](#5-diagrama-de-componentes)
6. [Diagrama de despliegue](#6-diagrama-de-despliegue)

---

## 1. Diagrama de clases del dominio

Clases de negocio y sus relaciones (corresponden a los modelos de Sequelize).

```mermaid
classDiagram
    class Usuario {
        +int id
        +string email
        +string password
        +tipo : cliente | empleado
    }
    class Cliente {
        +int id
        +string nombre
        +string apellido
        +string telefono
        +date fechaRegistro
        +bool activo
    }
    class Empleado {
        +int id
        +string nombre
        +string apellido
        +string puesto
        +decimal salario
        +bool activo
    }
    class DireccionCliente {
        +int id
        +string direccion
        +string ciudad
        +string pais
        +bool esPredeterminada
    }
    class Categoria {
        +int id
        +string nombre
        +string descripcion
    }
    class Proveedor {
        +int id
        +string nombreEmpresa
        +string contacto
        +string email
    }
    class Producto {
        +int id
        +string nombre
        +string marca
        +decimal precioCosto
        +decimal precioVenta
        +genero : hombre | mujer | unisex
        +bool activo
    }
    class Variante {
        +int id
        +string sku
        +string talla
        +string color
        +int stock
        +int stockMinimo
        +bool activo
        +estado() disponible | pocas_unidades | agotado
    }
    class Carrito {
        +int id
        +datetime fechaActualizacion
    }
    class DetalleCarrito {
        +int cantidad
        +decimal precioAlAgregar
    }
    class Cupon {
        +int id
        +string codigo
        +tipo : porcentaje | monto
        +decimal valor
        +int usosMaximos
        +int usosActuales
        +decimal montoMinimo
        +bool activo
    }
    class Pedido {
        +int id
        +estado : pendiente | pagado | enviado | cancelado
        +decimal subtotal
        +decimal descuento
        +decimal impuestos
        +decimal costoEnvio
        +decimal total
        +string transportista
        +string numeroGuia
    }
    class DetallePedido {
        +int cantidad
        +decimal precioUnitario
        +decimal subtotal
    }
    class Pago {
        +int id
        +decimal monto
        +estadoPago : pendiente | completado | fallido | reembolsado
        +string referenciaTransaccion
    }
    class MovimientoInventario {
        +int id
        +tipo : entrada | salida
        +int cantidad
        +string motivo
        +datetime fecha
    }
    class ListaNegra {
        +int id
        +string email
        +string motivo
        +bool activo
    }

    Usuario "1" -- "0..1" Cliente : perfil
    Usuario "1" -- "0..1" Empleado : perfil
    Cliente "1" *-- "0..*" DireccionCliente
    Cliente "1" -- "0..1" Carrito
    Carrito "1" *-- "0..*" DetalleCarrito
    DetalleCarrito "0..*" --> "1" Variante
    Categoria "0..1" o-- "0..*" Categoria : subcategorias
    Categoria "1" o-- "0..*" Producto
    Proveedor "1" o-- "0..*" Producto
    Producto "1" *-- "1..*" Variante
    Cliente "1" -- "0..*" Pedido : realiza
    Empleado "0..1" -- "0..*" Pedido : confirma
    DireccionCliente "1" -- "0..*" Pedido : envio a
    Cupon "0..1" -- "0..*" Pedido : aplicado en
    Pedido "1" *-- "1..*" DetallePedido
    DetallePedido "0..*" --> "1" Variante
    Pedido "1" -- "0..1" Pago
    Pedido "0..1" -- "0..*" MovimientoInventario : origina
    Variante "1" -- "0..*" MovimientoInventario
    Empleado "1" -- "0..*" ListaNegra : bloquea
```

---

## 2. Diagramas de secuencia

### 2.1 Inicio de sesión y petición autenticada

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend (api.js)
    participant B as Backend
    participant DB as PostgreSQL

    U->>F: Correo y contraseña
    F->>B: POST /api/auth/login
    B->>DB: Busca usuario por lower(email)
    B->>B: bcrypt.compare
    B->>DB: ¿Está en lista_negra (activo)?
    B->>DB: ¿Perfil con activo = false?
    B-->>F: 200 { token, usuario, cliente | empleado }
    F->>F: Guarda token, usuario y cliente en localStorage

    U->>F: Abre una pantalla protegida
    F->>B: GET /api/... + Authorization: Bearer token
    B->>B: jwt.verify
    B->>DB: ¿Perfil activo?
    B->>B: Comprueba rol (isEmpleado / isEmpleadoODueno)
    B-->>F: 200 datos
    Note over F,B: Ante 401 o 403 CUENTA_DESACTIVADA,<br/>api.js cierra la sesión y envía a /login
```

### 2.2 Creación de un pedido con cupón

```mermaid
sequenceDiagram
    actor C as Cliente
    participant F as Frontend
    participant B as pedido.controller
    participant R as reserva.service
    participant CS as cupon.service
    participant DB as PostgreSQL

    C->>F: Pagar
    F->>B: POST /api/pedidos { id_cliente, id_direccion_envio, items, codigo_cupon }
    B->>R: expirarPedidosVencidos()
    R->>DB: Libera reservas vencidas
    B->>DB: BEGIN
    B->>DB: Valida que la dirección sea del cliente
    loop Por variante, en orden de id
        B->>DB: SELECT variante FOR UPDATE
        B->>DB: Verifica activa y stock
        B->>DB: stock = stock - cantidad
    end
    B->>CS: validarYCalcular(código, subtotal, transacción)
    CS->>DB: SELECT cupón FOR UPDATE
    CS-->>B: descuento
    B->>DB: usos_actuales + 1
    B->>B: calcularTotales(subtotal, descuento)
    B->>DB: INSERT pedido (pendiente), detalles y movimientos (salida)
    B->>DB: COMMIT
    B-->>F: 201 pedido
    Note over B,DB: Cualquier error hace ROLLBACK:<br/>también se devuelve el stock reservado
```

### 2.3 Pago exitoso

Ver el diagrama completo en [Pagos con Stripe](07-pagos-stripe.md#flujo-de-un-pago-exitoso).

### 2.4 Pago que llega con el pedido ya cancelado

```mermaid
sequenceDiagram
    participant CR as Cron
    participant B as Backend
    participant S as Stripe
    participant DB as PostgreSQL

    CR->>B: POST /api/pedidos/expirar (x-cron-secret)
    B->>S: Cancela el PaymentIntent (abandoned)
    B->>DB: Pedido cancelado, stock y cupón devueltos
    Note over S,B: El cliente alcanza a pagar justo antes<br/>de que se cancele el intent
    S->>B: Webhook payment_intent.succeeded
    B->>DB: Pedido ya está "cancelado"
    B->>S: refunds.create (idempotente)
    B->>DB: Pago = "reembolsado"
```

### 2.5 Reembolso por un empleado

```mermaid
sequenceDiagram
    actor E as Empleado
    participant F as Frontend
    participant B as Backend
    participant S as Stripe
    participant DB as PostgreSQL

    E->>F: Reembolsar pedido #15
    F->>B: POST /api/pedidos/15/reembolso
    B->>DB: BEGIN, bloquea el pedido
    B->>DB: Verifica estado "pagado" y pago "completado"
    B->>S: refunds.create (idempotente)
    alt Stripe falla
        S-->>B: Error
        B->>DB: ROLLBACK (no se modifica nada)
        B-->>F: 500
    else Stripe acepta
        S-->>B: Reembolso OK
        B->>DB: Devuelve stock + movimientos "reembolso de pedido"
        B->>DB: Devuelve uso del cupón
        B->>DB: Pedido "cancelado", pago "reembolsado"
        B->>DB: COMMIT
        B-->>F: 200 { refund_id, pedido }
    end
```

### 2.6 Ajuste manual de inventario

```mermaid
sequenceDiagram
    actor E as Empleado
    participant B as Backend
    participant I as inventario.service
    participant DB as PostgreSQL

    E->>B: POST /api/variantes/5/stock { tipo_movimiento, cantidad, motivo }
    B->>B: Valida tipo, cantidad entera > 0 y motivo
    B->>I: ajustarStock(...)
    I->>DB: BEGIN, SELECT variante FOR UPDATE
    I->>I: nuevoStock = stock ± cantidad
    alt nuevoStock < 0
        I-->>B: ErrorInventario 409
        B-->>E: 409 stock insuficiente
    else
        I->>DB: UPDATE variante, INSERT movimiento
        I->>DB: COMMIT
        B-->>E: 200 variante y movimiento
    end
```

---

## 3. Diagramas de estado

### 3.1 Pedido

```mermaid
stateDiagram-v2
    [*] --> pendiente : Pedido creado, stock reservado
    pendiente --> pagado : Webhook succeeded
    pendiente --> cancelado : Cancelación (cliente o empleado)
    pendiente --> cancelado : Expira la reserva
    pagado --> enviado : Empleado registra envío
    pagado --> cancelado : Reembolso
    enviado --> [*]
    cancelado --> [*]
```

### 3.2 Pago

```mermaid
stateDiagram-v2
    [*] --> pendiente : PaymentIntent creado
    pendiente --> completado : succeeded
    pendiente --> fallido : payment_failed / canceled / pedido cancelado
    fallido --> pendiente : El cliente reintenta
    completado --> reembolsado : Reembolso
    fallido --> reembolsado : Pagó a un pedido ya cancelado
    reembolsado --> [*]
```

### 3.3 Cuenta de usuario

```mermaid
stateDiagram-v2
    [*] --> activa : Registro
    activa --> desactivada : El cliente o un empleado la desactiva
    desactivada --> activa : Un empleado la reactiva
    activa --> bloqueada : Empleado la agrega a la lista negra
    bloqueada --> activa : Empleado la desbloquea
```

### 3.4 Disponibilidad de una variante

```mermaid
stateDiagram-v2
    [*] --> disponible : stock > stock_minimo
    disponible --> pocas_unidades : stock <= stock_minimo
    pocas_unidades --> agotado : stock <= 0
    agotado --> pocas_unidades : Entrada de inventario
    pocas_unidades --> disponible : Entrada de inventario
```

---

## 4. Diagrama de actividades: compra

```mermaid
flowchart TD
    A([Inicio]) --> B[Explorar catálogo]
    B --> C[Elegir talla y color]
    C --> D{¿Sesión iniciada?}
    D -- No --> E[Iniciar sesión o registrarse] --> F
    D -- Sí --> F[Agregar al carrito]
    F --> G{¿Todas las líneas disponibles?}
    G -- No --> H[Ajustar o quitar líneas] --> G
    G -- Sí --> I{¿Tiene cupón?}
    I -- Sí --> J[Aplicar cupón] --> K
    I -- No --> K[Elegir dirección de envío]
    K --> L[Crear pedido: stock reservado]
    L --> M{¿Stock suficiente?}
    M -- No --> H
    M -- Sí --> N[Crear PaymentIntent]
    N --> O[Ingresar tarjeta en Stripe]
    O --> P{¿Pago aceptado?}
    P -- No --> Q{¿Reintentar?}
    Q -- Sí --> O
    Q -- No --> R[Cancelar pedido: se libera el stock] --> Z
    P -- Sí --> S[Esperar webhook]
    S --> T[Pedido pagado]
    T --> U[Descargar comprobante]
    U --> V[Empleado marca el envío]
    V --> Z([Fin])
```

---

## 5. Diagrama de componentes

```mermaid
flowchart TB
    subgraph FE["Frontend - EngineSport-frontend"]
        direction TB
        PG["Páginas<br/>(catalogo, ventas, cuenta, admin)"]
        CMP["Componentes compartidos"]
        CTX["AuthContext"]
        HK["Hooks (useApi...)"]
        API["api.js"]
        SJS["Stripe.js<br/>@stripe/react-stripe-js"]
        PG --> CMP
        PG --> HK
        PG --> CTX
        HK --> API
        CTX --> API
        PG --> SJS
    end

    subgraph BE["Backend - EngineSport"]
        direction TB
        RT["Rutas"]
        MW["Middlewares<br/>authJwt, pedidoAuth"]
        CT["Controladores"]
        SV["Servicios<br/>totales, cupon,<br/>inventario, reserva"]
        MD["Modelos Sequelize"]
        PDF["pdfkit<br/>(comprobantes)"]
        RT --> MW --> CT
        CT --> SV
        CT --> MD
        SV --> MD
        CT --> PDF
    end

    DB[("PostgreSQL")]
    STR["Stripe API"]

    API -- "REST / JSON" --> RT
    SJS -- "Datos de tarjeta" --> STR
    MD --> DB
    SV -- "stripe SDK" --> STR
    CT -- "stripe SDK" --> STR
    STR -- "Webhook" --> RT
```

---

## 6. Diagrama de despliegue

```mermaid
flowchart LR
    subgraph Cliente["Dispositivo del usuario"]
        NAV["Navegador web<br/>React SPA"]
    end

    subgraph RenderCloud["Render"]
        STAT["Static Site<br/>EngineSport-frontend<br/>(carpeta dist)"]
        WEB["Web Service<br/>Node.js 24 + Express<br/>EngineSport"]
    end

    subgraph NeonCloud["Neon"]
        PG[("PostgreSQL<br/>(SSL)")]
    end

    subgraph StripeCloud["Stripe"]
        SAPI["API de pagos"]
    end

    CRONSVC["Servicio de cron / ping"]

    NAV -- "HTTPS: descarga la app" --> STAT
    NAV -- "HTTPS / JSON" --> WEB
    NAV -- "HTTPS: tarjeta" --> SAPI
    WEB -- "TCP + SSL" --> PG
    WEB -- "HTTPS" --> SAPI
    SAPI -- "Webhook HTTPS" --> WEB
    CRONSVC -- "GET /health<br/>POST /api/pedidos/expirar" --> WEB
```
