// app/controllers/empleado.controller.js
const bcrypt = require("bcryptjs");
const db = require("../models");
const Usuario = db.usuarios;
const Empleado = db.empleados;

const SALT_ROUNDS = 10;

// Crear un nuevo empleado. Solo un empleado autenticado puede hacerlo
// (ver middleware isEmpleado en la ruta) — no existe registro público de empleados.
// Crea el usuario (tipo "empleado") y su perfil en una sola transacción.
exports.create = async (req, res) => {
  const t = await db.sequelize.transaction();

  try {
    const { email, password, nombre, apellido, puesto, telefono, correo, salario, fecha_contratacion } = req.body;

    if (!email || !password) {
      await t.rollback();
      return res.status(400).json({ message: "email y password son obligatorios." });
    }

    if (password.length < 6) {
      await t.rollback();
      return res.status(400).json({ message: "El password debe tener al menos 6 caracteres." });
    }

    if (salario !== undefined && salario < 0) {
      await t.rollback();
      return res.status(400).json({ message: "El salario no puede ser negativo." });
    }

    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      await t.rollback();
      return res.status(409).json({ message: "Ya existe un usuario registrado con ese email." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const nuevoUsuario = await Usuario.create(
      { email, password: passwordHash, tipo: "empleado" },
      { transaction: t }
    );

    const nuevoEmpleado = await Empleado.create(
      {
        id_usuario: nuevoUsuario.id,
        nombre,
        apellido,
        puesto,
        telefono,
        correo,
        salario,
        fecha_contratacion
      },
      { transaction: t }
    );

    await t.commit();

    res.status(201).json({
      message: "Empleado creado correctamente.",
      usuario: { id: nuevoUsuario.id, email: nuevoUsuario.email, tipo: nuevoUsuario.tipo },
      empleado: nuevoEmpleado
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al crear el empleado.", error: error.message });
  }
};

// Listar todos los empleados
exports.findAll = async (req, res) => {
  try {
    const empleados = await Empleado.findAll({
      include: [{ association: "usuario", attributes: { exclude: ["password"] } }]
    });
    res.status(200).json(empleados);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los empleados.", error: error.message });
  }
};

// Obtener un empleado por su id
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const empleado = await Empleado.findByPk(id, {
      include: [{ association: "usuario", attributes: { exclude: ["password"] } }]
    });

    if (!empleado) {
      return res.status(404).json({ message: `No se encontró un empleado con id ${id}.` });
    }

    res.status(200).json(empleado);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el empleado.", error: error.message });
  }
};

// Actualizar datos de perfil de un empleado (no email/password, ver auth.controller.js)
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, puesto, telefono, correo, salario, activo } = req.body;

    if (salario !== undefined && salario < 0) {
      return res.status(400).json({ message: "El salario no puede ser negativo." });
    }

    const [filasActualizadas] = await Empleado.update(
      { nombre, apellido, puesto, telefono, correo, salario, activo },
      { where: { id_empleado: id } }
    );

    if (filasActualizadas === 0) {
      return res.status(404).json({ message: `No se encontró un empleado con id ${id}, o no había cambios que aplicar.` });
    }

    res.status(200).json({ message: "Empleado actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el empleado.", error: error.message });
  }
};

// Eliminar un empleado
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const filasEliminadas = await Empleado.destroy({
      where: { id_empleado: id }
    });

    if (filasEliminadas === 0) {
      return res.status(404).json({ message: `No se encontró un empleado con id ${id}.` });
    }

    res.status(200).json({ message: "Empleado eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el empleado.", error: error.message });
  }
};