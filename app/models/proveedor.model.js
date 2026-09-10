// app/models/proveedor.model.js
module.exports = (sequelize, Sequelize) => {
  const Proveedor = sequelize.define(
    "proveedor",
    {
      nombre_empresa: {
        type: Sequelize.STRING,
        allowNull: false
      },
      contacto: {
        type: Sequelize.STRING
      },
      telefono: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      direccion: {
        type: Sequelize.STRING
      }
    },
    {
      tableName: "proveedores"
    }
  );

  return Proveedor;
};