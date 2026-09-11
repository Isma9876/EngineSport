// app/models/pago.model.js
module.exports = (sequelize, DataTypes) => {
  const Pago = sequelize.define(
    "pagos",
    {
      id_pago: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_pedido: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      metodo_pago: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "stripe",
      },
      monto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      fecha_pago: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      estado_pago: {
        type: DataTypes.ENUM("pendiente", "completado", "fallido", "reembolsado"),
        allowNull: false,
        defaultValue: "pendiente",
      },
      referencia_transaccion: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "pagos",
      timestamps: false,
    }
  );

  return Pago;
};