// app/models/pedido.model.js
module.exports = (sequelize, DataTypes) => {
  const Pedido = sequelize.define(
    "pedidos",
    {
      id_pedido: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_cliente: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_empleado: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      id_direccion_envio: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fecha_pedido: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      estado: {
        type: DataTypes.ENUM("pendiente", "pagado", "enviado", "cancelado"),
        allowNull: false,
        defaultValue: "pendiente",
      },
      subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      impuestos: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "pedidos",
      timestamps: false,
    }
  );

  return Pedido;
};