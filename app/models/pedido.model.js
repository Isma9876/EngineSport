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
      id_cupon: { 
        type: DataTypes.INTEGER, 
        allowNull: true, 
      },
      descuento: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: false, defaultValue: 0,
       },
      numero_guia: { 
        type: DataTypes.STRING(100), 
        allowNull: true,
       },
      fecha_envio: { 
        type: DataTypes.DATE, 
        allowNull: true, 
      },
            costo_envio: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      transportista: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
    },
    {
      tableName: "pedidos",
      timestamps: false,
    }
  );

  return Pedido;
};