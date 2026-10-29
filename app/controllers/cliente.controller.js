// app/controllers/cliente.controller.js
const bcrypt = require("bcryptjs");
const db = require("../models");
const Cliente = db.clientes;
const Usuario = db.usuarios;

// Listar clientes (solo empleados).
// Por defecto muestra únicamente los ACTIVOS.
//   GET /api/clientes                 -> activos
//   GET /api/clientes?activo=false    -> solo desactivados (para poder reactivarlos)
//   GET /api/clientes?activo=todos    -> todos
exports.findAll = async (req, res) => {
  try {
    const { activo } = req.query;
    const where = {};
    if (activo === "false") {
      where.activo = false;
    } else if (activo !== "todos") {
      where.activo = true;
    }

    const clientes = await Cliente.findAll({
      where,
      include: [{ association: "usuario", attributes: { exclude: ["password"] } }]
    });
    res.status(200).json(clientes);
  } catch (error) {
    console.error("Error al obtener los clientes.", error);
    res.status(500).json({ message: "Error al obtener los clientes." });
  }
};

// Obtener un cliente por su id (el propio cliente dueño, o un empleado).
// Devuelve también a los desactivados, para que un empleado pueda consultarlos.
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findByPk(id, {
      include: [
        { association: "usuario", attributes: { exclude: ["password"] } },
        { association: "direcciones" }
      ]
    });

    if (!cliente) {
      return res.status(404).json({ message: `No se encontró un cliente con id ${id}.` });
    }

    res.status(200).json(cliente);
  } catch (error) {
    console.error("Error al obtener el cliente.", error);
    res.status(500).json({ message: "Error al obtener el cliente." });
  }
};

// Actualizar datos de perfil de un cliente (el propio cliente dueño, o un empleado)
// Nota: el email/password se manejan aparte, en auth.controller.js — no se tocan aquí.
// Un empleado también puede REACTIVAR una cuenta enviando { "activo": true }.
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, telefono, activo } = req.body;

    const camposPermitidos = { nombre, apellido, telefono };
    // Solo un empleado puede activar/desactivar la cuenta de un cliente.
    if (req.usuario.tipo === "empleado" && activo !== undefined) {
      camposPermitidos.activo = activo;
    }

    const [filasActualizadas] = await Cliente.update(camposPermitidos, {
      where: { id_cliente: id }
    });

    if (filasActualizadas === 0) {
      return res.status(404).json({ message: `No se encontró un cliente con id ${id}, o no había cambios que aplicar.` });
    }

    res.status(200).json({ message: "Cliente actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar el cliente.", error);
    res.status(500).json({ message: "Error al actualizar el cliente." });
  }
};

// Desactivar un cliente (solo empleados).
// NO borra filas ni modifica datos: solo marca activo = false. Así se conservan
// pedidos, pagos y comprobantes, y la cuenta se puede reactivar con PUT { activo: true }.
// Mientras esté desactivada: el login responde 403 y el correo queda reservado.
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const [filasActualizadas] = await Cliente.update(
      { activo: false },
      { where: { id_cliente: id } }
    );

    if (filasActualizadas === 0) {
      return res.status(404).json({ message: `No se encontró un cliente con id ${id}.` });
    }

    res.status(200).json({ message: "Cuenta desactivada correctamente." });
  } catch (error) {
    console.error("Error al desactivar el cliente.", error);
    res.status(500).json({ message: "Error al desactivar el cliente." });
  }
};

// El propio cliente desactiva su cuenta, confirmando su contraseña.
// Ruta: POST /api/clientes/me/eliminar-cuenta  (body: { "password": "..." })
exports.eliminarMiCuenta = async (req, res) => {
  const { password } = req.body || {};

  if (req.usuario.tipo !== "cliente") {
    return res.status(403).json({ message: "Solo los clientes pueden eliminar su cuenta por esta vía." });
  }

  if (!password) {
    return res.status(400).json({ message: "Debes confirmar tu contraseña." });
  }

  try {
    const usuario = await Usuario.findByPk(req.usuario.id);
    const cliente = await Cliente.findOne({ where: { id_usuario: req.usuario.id } });

    if (!usuario || !cliente) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ message: "Contraseña incorrecta." });
    }

    await cliente.update({ activo: false });

    res.status(200).json({ message: "Tu cuenta fue desactivada." });
  } catch (error) {
    console.error("Error al desactivar la cuenta.", error);
    res.status(500).json({ message: "Error al desactivar la cuenta." });
  }
};

// Helper para el middleware isEmpleadoODueno: dado un id_cliente (route param),
// devuelve el id_usuario dueño de ese perfil.
exports.obtenerIdUsuarioDeCliente = async (req) => {
  const cliente = await Cliente.findByPk(req.params.id);
  return cliente ? cliente.id_usuario : null;
};