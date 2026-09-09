// app/models/categoria.model.js
module.exports = (sequelize, Sequelize) => {
  const Categoria = sequelize.define(
    "categoria",
    {
      nombre: {
        type: Sequelize.STRING,
        allowNull: false
      },
      descripcion: {
        type: Sequelize.TEXT
      }
    },
    {
      tableName: "categorias" // forzamos el nombre exacto de la tabla, tal como está en el esquema acordado
    }
  );

  return Categoria;
};