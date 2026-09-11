// app/models/cliente.model.js
module.exports = (sequelize, Sequelize) => {
  const Cliente = sequelize.define(
    "cliente",
    {
      nombre: {
        type: Sequelize.STRING
      },
      apellido: {
        type: Sequelize.STRING
      },
      telefono: {
        type: Sequelize.STRING
      },
      fecha_registro: {
        type: Sequelize.DATEONLY,
        defaultValue: Sequelize.NOW
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: "clientes"
    }
  );

  return Cliente;
};