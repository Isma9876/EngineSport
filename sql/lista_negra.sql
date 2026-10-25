-- sql/lista_negra.sql
-- Tabla nueva: lista_negra (cuentas bloqueadas como sanción).
-- No modifica ni borra datos de ninguna otra tabla.
--
-- Cómo aplicarla:
--   1. PRIMERO en la rama de Neon de prueba (nunca directo en producción).
--   2. A producción, de común acuerdo con el equipo, ANTES de fusionar el PR,
--      para que prevalezca esta definición sobre la que crearía sync().
--
-- Requiere que la tabla "empleados" ya exista.

BEGIN;

-- =====================================================
-- BLOQUE 0: si sequelize.sync() ya creó lista_negra (sin las restricciones
-- de este script), se elimina solo si está vacía; si tiene datos, se aborta.
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.lista_negra') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.lista_negra) THEN
      RAISE EXCEPTION 'lista_negra ya existe y tiene datos. Revisar antes de continuar.';
    END IF;
    DROP TABLE public.lista_negra;
  END IF;
END $$;

-- =====================================================
-- BLOQUE 1: Crear la tabla lista_negra
-- Desbloquear no borra la fila: activo = false y se guarda cuándo y quién.
-- id_usuario va sin llave foránea a propósito (el registro del bloqueo debe
-- sobrevivir a cambios en usuarios). ON DELETE RESTRICT en los empleados:
-- no se puede borrar un empleado que bloqueó o desbloqueó; se desactiva.
-- =====================================================

CREATE TABLE lista_negra (
  id_lista_negra         SERIAL PRIMARY KEY,
  email                  VARCHAR(255) NOT NULL UNIQUE,
  id_usuario             INTEGER,
  motivo                 TEXT NOT NULL,
  id_empleado            INTEGER NOT NULL
                         REFERENCES empleados(id_empleado)
                         ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activo                 BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_desbloqueo       TIMESTAMPTZ,
  id_empleado_desbloqueo INTEGER
                         REFERENCES empleados(id_empleado)
                         ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_lista_negra_id_usuario ON lista_negra(id_usuario);

COMMIT;