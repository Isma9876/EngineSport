// app/models/usuario.model.js
module.exports = (sequelize, Sequelize) => {
  const Usuario = sequelize.define(
    "usuario",
    {
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
        // Se guarda siempre como hash (bcryptjs), nunca en texto plano.
      },
      tipo: {
        type: Sequelize.ENUM("cliente", "empleado"),
        allowNull: false
      }
    },
    {
      tableName: "usuarios"
      // Nota: el campo "password" NO se excluye aquí por defecto (defaultScope).
      // Cada controlador es responsable de nunca incluirlo en las respuestas
      // (usar attributes: { exclude: ["password"] } al hacer findAll/findByPk).
    }
  );

  return Usuario;
};