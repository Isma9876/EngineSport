// app/models/producto.model.js
module.exports = (sequelize, Sequelize) => {
  const Producto = sequelize.define(
    "producto",
    {
      nombre: {
        type: Sequelize.STRING,
        allowNull: false
      },
      descripcion: {
        type: Sequelize.TEXT
      },
      marca: {
        type: Sequelize.STRING(100)
      },
      precio_costo: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      precio_venta: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
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