// app/models/detalleCarrito.model.js
// Una fila por variante dentro del carrito (UNIQUE id_carrito + id_variante).
// No guarda el precio vigente ni el stock: se leen al consultar.
// precio_al_agregar solo sirve para avisar "el precio cambió".
module.exports = (sequelize, DataTypes) => {
  const DetalleCarrito = sequelize.define(
    "detalle_carrito",
    {
      id_detalle_carrito: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_carrito: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_variante: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      cantidad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      precio_al_agregar: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      fecha_agregado: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "detalle_carrito",
      timestamps: false,
      indexes: [{ unique: true, fields: ["id_carrito", "id_variante"], name: "uq_carrito_variante" }],
    }
  );

  return DetalleCarrito;
};