// app/models/movimientoInventario.model.js
module.exports = (sequelize, DataTypes) => {
  const MovimientoInventario = sequelize.define(
    "movimientos_inventario",
    {
      id_movimiento: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_producto: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tipo_movimiento: {
        type: DataTypes.ENUM("entrada", "salida"),
        allowNull: false,
      },
      cantidad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      motivo: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      id_pedido: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "movimientos_inventario",
      timestamps: false,
    }
  );

  return MovimientoInventario;
};