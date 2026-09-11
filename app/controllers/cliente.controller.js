// app/controllers/cliente.controller.js
const db = require("../models");
const Cliente = db.clientes;

// Listar todos los clientes (solo empleados)
exports.findAll = async (req, res) => {
  try {
    const clientes = await Cliente.findAll({
      include: [{ association: "usuario", attributes: { exclude: ["password"] } }]
    });
    res.status(200).json(clientes);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los clientes.", error: error.message });
  }
};

// Obtener un cliente por su id (el propio cliente dueño, o un empleado)
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
    res.status(500).json({ message: "Error al obtener el cliente.", error: error.message });
  }
};

// Actualizar datos de perfil de un cliente (el propio cliente dueño, o un empleado)
// Nota: el email/password se manejan aparte, en auth.controller.js — no se tocan aquí.
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
    res.status(500).json({ message: "Error al actualizar el cliente.", error: error.message });
  }
};

// Eliminar un cliente (solo empleados) — no borra el usuario asociado, ver nota en la ruta.
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const filasEliminadas = await Cliente.destroy({
      where: { id_cliente: id }
    });

    if (filasEliminadas === 0) {
      return res.status(404).json({ message: `No se encontró un cliente con id ${id}.` });
    }

    res.status(200).json({ message: "Cliente eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el cliente.", error: error.message });
  }
};

// Helper para el middleware isEmpleadoODueno: dado un id_cliente (route param),
// devuelve el id_usuario dueño de ese perfil.
exports.obtenerIdUsuarioDeCliente = async (req) => {
  const cliente = await Cliente.findByPk(req.params.id);
  return cliente ? cliente.id_usuario : null;
};