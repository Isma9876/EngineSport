BEGIN;

-- =====================================================
-- BLOQUE 0: si sequelize.sync() ya creó variantes_producto (sin las restricciones
-- de este script), se elimina solo si está vacía; si tiene datos, se aborta.
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.variantes_producto') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.variantes_producto) THEN
      RAISE EXCEPTION 'variantes_producto ya existe y tiene datos. Revisar antes de continuar.';
    END IF;
    DROP TABLE public.variantes_producto;
  END IF;
END $$;
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

-- Evita variantes duplicadas (mismo producto, talla y color), incluso con NULL
CREATE UNIQUE INDEX uq_variante_producto_talla_color
  ON variantes_producto (id_producto, COALESCE(talla, ''), COALESCE(color, ''));

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
-- ON DELETE RESTRICT: no se puede borrar una variante que ya tiene ventas;
-- si deja de venderse, se desactiva con activo = false.
-- =====================================================

DELETE FROM detalle_pedidos;
DELETE FROM movimientos_inventario;

ALTER TABLE detalle_pedidos
  DROP COLUMN id_producto,
  ADD COLUMN id_variante INTEGER NOT NULL
    REFERENCES variantes_producto(id_variante)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE movimientos_inventario
  DROP COLUMN id_producto,
  ADD COLUMN id_variante INTEGER NOT NULL
    REFERENCES variantes_producto(id_variante)
    ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX idx_detalle_pedidos_id_variante
  ON detalle_pedidos(id_variante);
CREATE INDEX idx_movimientos_id_variante
  ON movimientos_inventario(id_variante);

-- =====================================================
-- BLOQUE 4: Limpiar datos de prueba
-- =====================================================

DELETE FROM pagos;
DELETE FROM pedidos;
UPDATE cupones SET usos_actuales = 0;
DELETE FROM productos;

COMMIT;