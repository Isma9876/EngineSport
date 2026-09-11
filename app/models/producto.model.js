// app/models/producto.model.js
module.exports = (sequelize, DataTypes) => {
  const Producto = sequelize.define(
    "productos",
    {
      id_producto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sku: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      nombre: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      precio_costo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      precio_venta: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      stock_minimo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "productos",
      timestamps: false,
    }
  );

  return Producto;
};