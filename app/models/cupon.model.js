// app/models/cupon.model.js
module.exports = (sequelize, Sequelize) => {
  const Cupon = sequelize.define(
    "cupones",
    {
      id_cupon: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      codigo: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      descripcion: { type: Sequelize.STRING(200) },
      tipo: { type: Sequelize.STRING(20), allowNull: false }, // "porcentaje" | "monto"
      valor: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      vigencia_inicio: { type: Sequelize.DATE },
      vigencia_fin: { type: Sequelize.DATE },
      usos_maximos: { type: Sequelize.INTEGER }, // null = ilimitado
      usos_actuales: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      monto_minimo: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { tableName: "cupones", timestamps: false }
  );
  return Cupon;
};