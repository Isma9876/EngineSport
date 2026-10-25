// app/models/listaNegra.model.js
// Cuentas bloqueadas como sanción (distinto de la desactivación por activo = false).
// Desbloquear NO borra la fila: pone activo = false y deja el rastro de quién y cuándo.
module.exports = (sequelize, Sequelize) => {
  const ListaNegra = sequelize.define(
    "lista_negra",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: "id_lista_negra"
      },
      // Siempre en minúsculas y sin espacios (se normaliza en el controlador).
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      // Sin llave foránea a propósito: el registro del bloqueo debe sobrevivir
      // a cualquier cambio en la tabla usuarios.
      id_usuario: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      motivo: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      // Empleado que bloqueó (id de la tabla empleados, no de usuarios).
      id_empleado: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "empleados", key: "id_empleado" }
      },
      fecha: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      fecha_desbloqueo: {
        type: Sequelize.DATE,
        allowNull: true
      },
      id_empleado_desbloqueo: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "empleados", key: "id_empleado" }
      }
    },
    {
      tableName: "lista_negra",
      timestamps: false,
      // El nombre del índice coincide con el de sql/lista_negra.sql para que
      // sync() no cree un duplicado.
      indexes: [{ name: "idx_lista_negra_id_usuario", fields: ["id_usuario"] }]
    }
  );

  return ListaNegra;
};