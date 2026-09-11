// app/models/direccionCliente.model.js
module.exports = (sequelize, Sequelize) => {
  const DireccionCliente = sequelize.define(
    "direccionCliente",
    {
      direccion: {
        type: Sequelize.STRING
      },
      ciudad: {
        type: Sequelize.STRING
      },
      estado: {
        type: Sequelize.STRING
      },
      codigo_postal: {
        type: Sequelize.STRING
      },
      pais: {
        type: Sequelize.STRING
      },
      es_predeterminada: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      tableName: "direcciones_cliente"
    }
  );

  return DireccionCliente;
};