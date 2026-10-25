// app/controllers/listaNegra.controller.js
const db = require("../models");
const ListaNegra = db.listaNegra;
const Usuario = db.usuarios;
const Empleado = db.empleados;
const { Op } = db.Sequelize;

const MOTIVO_MAX = 500;

// El token trae el id de "usuarios", pero lista_negra guarda el id de "empleados".
async function obtenerEmpleadoActual(req) {
  return Empleado.findOne({ where: { id_usuario: req.usuario.id } });
}

// Bloquear una cuenta de cliente (solo empleados).
// POST /api/lista-negra   body: { "id_usuario": 12, "motivo": "..." }
// - Solo se pueden bloquear cuentas tipo cliente.
// - Si la cuenta ya estuvo bloqueada y se desbloqueó, se REACTIVA la misma fila
//   (el correo es único) con el nuevo motivo y el nuevo empleado.
exports.create = async (req, res) => {
  try {
    const { id_usuario, motivo } = req.body || {};
    const motivoLimpio = typeof motivo === "string" ? motivo.trim() : "";

    if (!id_usuario || !motivoLimpio) {
      return res.status(400).json({ message: "id_usuario y motivo son obligatorios." });
    }

    if (motivoLimpio.length > MOTIVO_MAX) {
      return res.status(400).json({ message: `El motivo no puede superar los ${MOTIVO_MAX} caracteres.` });
    }

    const empleado = await obtenerEmpleadoActual(req);
    if (!empleado || empleado.activo === false) {
      return res.status(403).json({ message: "No se encontró un perfil de empleado activo para esta acción." });
    }

    const usuario = await Usuario.findByPk(id_usuario, { attributes: ["id", "email", "tipo"] });
    if (!usuario) {
      return res.status(404).json({ message: `No se encontró un usuario con id ${id_usuario}.` });
    }

    if (usuario.tipo !== "cliente") {
      return res.status(400).json({ message: "Solo se pueden bloquear cuentas de clientes." });
    }

    const email = usuario.email.trim().toLowerCase();

    const existente = await ListaNegra.findOne({
      where: { [Op.or]: [{ id_usuario: usuario.id }, { email }] }
    });

    if (existente && existente.activo) {
      return res.status(409).json({ message: "Esta cuenta ya está bloqueada." });
    }

    if (existente) {
      await existente.update({
        email,
        id_usuario: usuario.id,
        motivo: motivoLimpio,
        id_empleado: empleado.id,
        fecha: new Date(),
        activo: true,
        fecha_desbloqueo: null,
        id_empleado_desbloqueo: null
      });
      return res.status(200).json({ message: "Cuenta bloqueada nuevamente.", bloqueo: existente });
    }

    const nuevo = await ListaNegra.create({
      email,
      id_usuario: usuario.id,
      motivo: motivoLimpio,
      id_empleado: empleado.id
    });

    res.status(201).json({ message: "Cuenta bloqueada correctamente.", bloqueo: nuevo });
  } catch (error) {
    // Dos bloqueos simultáneos de la misma cuenta chocan con el correo único.
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Esta cuenta ya está bloqueada." });
    }
    res.status(500).json({ message: "Error al bloquear la cuenta.", error: error.message });
  }
};

// Listar bloqueos (solo empleados).
// Por defecto muestra únicamente los ACTIVOS, igual que GET /api/clientes.
//   GET /api/lista-negra                 -> bloqueos activos
//   GET /api/lista-negra?activo=false    -> solo desbloqueados (historial)
//   GET /api/lista-negra?activo=todos    -> todos
exports.findAll = async (req, res) => {
  try {
    const { activo } = req.query;
    const where = {};
    if (activo === "false") {
      where.activo = false;
    } else if (activo !== "todos") {
      where.activo = true;
    }

    const registros = await ListaNegra.findAll({
      where,
      order: [["fecha", "DESC"]]
    });
    res.status(200).json(registros);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener la lista negra.", error: error.message });
  }
};

// Desbloquear (solo empleados). NO borra la fila: activo = false y se guarda
// cuándo y quién desbloqueó. El :id es el de la fila de lista_negra.
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ message: "El id del bloqueo no es válido." });
    }

    const empleado = await obtenerEmpleadoActual(req);
    if (!empleado || empleado.activo === false) {
      return res.status(403).json({ message: "No se encontró un perfil de empleado activo para esta acción." });
    }

    const registro = await ListaNegra.findByPk(id);
    if (!registro) {
      return res.status(404).json({ message: `No se encontró un bloqueo con id ${id}.` });
    }

    if (!registro.activo) {
      return res.status(409).json({ message: "Esta cuenta ya estaba desbloqueada." });
    }

    await registro.update({
      activo: false,
      fecha_desbloqueo: new Date(),
      id_empleado_desbloqueo: empleado.id
    });

    res.status(200).json({ message: "Cuenta desbloqueada correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al desbloquear la cuenta.", error: error.message });
  }
};