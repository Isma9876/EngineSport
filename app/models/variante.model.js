// app/models/variante.model.js
module.exports = (sequelize, Sequelize) => {
  const Variante = sequelize.define(
    "variante",
    {
      sku: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      talla: {
        type: Sequelize.STRING(20)
      },
      color: {
        type: Sequelize.STRING(50)
      },
      imagen_url: {
        type: Sequelize.TEXT
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 }
      },
      stock_minimo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 }
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: "variantes_producto"
    }
  );

  return Variante;
};