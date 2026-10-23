// app/models/carrito.model.js
// Un carrito por cliente (id_cliente único). No expira: se conserva siempre.
module.exports = (sequelize, DataTypes) => {
  const Carrito = sequelize.define(
    "carritos",
    {
      id_carrito: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_cliente: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "carritos",
      timestamps: false,
    }
  );

  return Carrito;
};