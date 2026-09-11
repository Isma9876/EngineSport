// app/models/producto.model.js
module.exports = (sequelize, Sequelize) => {
  const Producto = sequelize.define(
    "producto",
    {
      sku: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      nombre: {
        type: Sequelize.STRING,
        allowNull: false
      },
      descripcion: {
        type: Sequelize.TEXT
      },
      precio_costo: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      precio_venta: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      stock_minimo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: "productos"
    }
  );

  return Producto;
};