// app/models/empleado.model.js
module.exports = (sequelize, Sequelize) => {
  const Empleado = sequelize.define(
    "empleado",
    {
      nombre: {
        type: Sequelize.STRING
      },
      apellido: {
        type: Sequelize.STRING
      },
      puesto: {
        type: Sequelize.STRING
      },
      telefono: {
        type: Sequelize.STRING
      },
      correo: {
        type: Sequelize.STRING,
        validate: {
          isEmail: true
        }
      },
      salario: {
        type: Sequelize.DECIMAL(10, 2)
      },
      fecha_contratacion: {
        type: Sequelize.DATEONLY,
        defaultValue: Sequelize.NOW
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: "empleados"
    }
  );

  return Empleado;
};