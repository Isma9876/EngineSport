BEGIN;

CREATE TABLE IF NOT EXISTS carritos (
  id_carrito SERIAL PRIMARY KEY,
  id_cliente INTEGER NOT NULL UNIQUE REFERENCES clientes(id_cliente) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detalle_carrito (
  id_detalle_carrito SERIAL PRIMARY KEY,
  id_carrito INTEGER NOT NULL REFERENCES carritos(id_carrito) ON DELETE CASCADE,
  id_variante INTEGER NOT NULL REFERENCES variantes_producto(id_variante) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_al_agregar NUMERIC(10,2) NOT NULL,
  fecha_agregado TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_carrito_variante UNIQUE (id_carrito, id_variante)
);

CREATE INDEX IF NOT EXISTS idx_detalle_carrito_variante ON detalle_carrito(id_variante);

COMMIT;