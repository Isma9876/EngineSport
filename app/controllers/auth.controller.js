// app/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../models");
const Usuario = db.usuarios;
const Cliente = db.clientes;

const SALT_ROUNDS = 10;

function firmarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

// Registro público: siempre crea un usuario tipo "cliente" + su perfil de cliente.
// Los empleados no se auto-registran por esta vía (ver empleado.controller.js).
exports.register = async (req, res) => {
  const t = await db.sequelize.transaction();

  try {
    const { email, password, nombre, apellido, telefono } = req.body;

    if (!email || !password) {
      await t.rollback();
      return res.status(400).json({ message: "email y password son obligatorios." });
    }

    if (password.length < 6) {
      await t.rollback();
      return res.status(400).json({ message: "El password debe tener al menos 6 caracteres." });
    }

    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      await t.rollback();
      return res.status(409).json({ message: "Ya existe un usuario registrado con ese email." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const nuevoUsuario = await Usuario.create(
      { email, password: passwordHash, tipo: "cliente" },
      { transaction: t }
    );

    const nuevoCliente = await Cliente.create(
      {
        id_usuario: nuevoUsuario.id,
        nombre,
        apellido,
        telefono
      },
      { transaction: t }
    );

    await t.commit();

    const token = firmarToken(nuevoUsuario);

    res.status(201).json({
      message: "Registro exitoso.",
      token,
      usuario: { id: nuevoUsuario.id, email: nuevoUsuario.email, tipo: nuevoUsuario.tipo },
      cliente: nuevoCliente
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al registrar el usuario.", error: error.message });
  }
};

// Login: válido tanto para clientes como para empleados (el "tipo" viene de la BD).
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email y password son obligatorios." });
    }

    const usuario = await Usuario.findOne({ where: { email } });

    // Mensaje genérico a propósito: no revelar si el email existe o no.
    if (!usuario) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    const token = firmarToken(usuario);

    res.status(200).json({
      message: "Login exitoso.",
      token,
      usuario: { id: usuario.id, email: usuario.email, tipo: usuario.tipo }
    });
  } catch (error) {
    res.status(500).json({ message: "Error al iniciar sesión.", error: error.message });
  }
};