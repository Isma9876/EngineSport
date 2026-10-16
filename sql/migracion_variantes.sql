BEGIN;
-- =====================================================
-- MIGRACIÓN: Variantes de producto
-- BLOQUE 1: Crear la tabla variantes_producto
-- =====================================================

CREATE TABLE variantes_producto (
  id_variante   SERIAL PRIMARY KEY,
  id_producto   INTEGER NOT NULL
                REFERENCES productos(id_producto)
                ON UPDATE CASCADE ON DELETE CASCADE,
  sku           VARCHAR(255) NOT NULL UNIQUE,
  talla         VARCHAR(20),
  color         VARCHAR(50),
  imagen_url    TEXT,
  stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo  INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variantes_id_producto ON variantes_producto(id_producto);

-- =====================================================
-- BLOQUE 2: Modificar la tabla productos
-- =====================================================

ALTER TABLE productos
  ADD COLUMN marca VARCHAR(100),
  DROP COLUMN sku,
  DROP COLUMN stock,
  DROP COLUMN stock_minimo;

  -- =====================================================
-- BLOQUE 3: Apuntar detalle_pedidos y movimientos_inventario a variantes
-- (Lytzy confirmó que los datos de prueba se pueden borrar)
-- =====================================================

DELETE FROM detalle_pedidos;
DELETE FROM movimientos_inventario;

ALTER TABLE detalle_pedidos
  DROP COLUMN id_producto,
  ADD COLUMN id_variante INTEGER NOT NULL
    REFERENCES variantes_producto(id_variante)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE movimientos_inventario
  DROP COLUMN id_producto,
  ADD COLUMN id_variante INTEGER NOT NULL
    REFERENCES variantes_producto(id_variante)
    ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX idx_detalle_pedidos_id_variante
  ON detalle_pedidos(id_variante);
CREATE INDEX idx_movimientos_id_variante
  ON movimientos_inventario(id_variante);

  -- =====================================================
-- BLOQUE 4: Limpiar datos de prueba
-- =====================================================

-- Pedidos de prueba (por CASCADE también se borran sus pagos)
DELETE FROM pedidos;

-- Productos de prueba (Isma los recrea después, ya con variantes)
DELETE FROM productos;

COMMIT;