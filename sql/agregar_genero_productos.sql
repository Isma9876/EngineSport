-- sql/agregar_genero_productos.sql
-- Agrega la columna "genero" a productos (hombre | mujer | unisex).
-- Solo toca la tabla productos; no borra ni modifica datos ni otras tablas.
-- Los productos existentes quedan como 'unisex'.
-- Es idempotente: se puede correr dos veces sin error.
--
-- Cómo aplicarla:
--   1. PRIMERO en la rama de Neon de prueba (nunca directo en producción).
--   2. A producción, de común acuerdo con el equipo, ANTES de fusionar el PR:
--      sequelize.sync() no agrega columnas a tablas que ya existen, así que
--      este script es lo que cambia la base; el modelo solo debe coincidir con él.

-- =====================================================
-- VERIFICACIÓN ANTES (ejecutar aparte, opcional)
-- =====================================================
-- ¿Existe ya la columna?
--   SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'productos' AND column_name = 'genero';
-- Total de productos (para comparar después):
--   SELECT COUNT(*) AS total_productos FROM productos;

BEGIN;

-- =====================================================
-- BLOQUE 1: Columna genero (los productos existentes toman 'unisex')
-- =====================================================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS genero VARCHAR(10) NOT NULL DEFAULT 'unisex';

-- =====================================================
-- BLOQUE 2: Restricción de valores permitidos
-- ADD CONSTRAINT no admite IF NOT EXISTS, así que se revisa antes en el catálogo.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'productos_genero_check'
      AND conrelid = 'public.productos'::regclass
  ) THEN
    ALTER TABLE productos
      ADD CONSTRAINT productos_genero_check
      CHECK (genero IN ('hombre', 'mujer', 'unisex'));
  END IF;
END $$;

COMMIT;

-- =====================================================
-- VERIFICACIÓN DESPUÉS (ejecutar aparte)
-- =====================================================
-- Debe mostrar: varchar(10), NOT NULL (is_nullable = 'NO'), default 'unisex'::character varying
--   SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'productos' AND column_name = 'genero';
-- Debe mostrar la restricción con CHECK (genero IN ('hombre','mujer','unisex')):
--   SELECT conname, pg_get_constraintdef(oid) AS definicion
--   FROM pg_constraint
--   WHERE conrelid = 'public.productos'::regclass AND conname = 'productos_genero_check';
-- Distribución por género (al inicio todos 'unisex'); la suma debe igualar total_productos:
--   SELECT genero, COUNT(*) FROM productos GROUP BY genero ORDER BY genero;
