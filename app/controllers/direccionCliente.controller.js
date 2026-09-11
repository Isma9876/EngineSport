// app/controllers/direccionCliente.controller.js
const db = require("../models");
const DireccionCliente = db.direccionesCliente;
const Cliente = db.clientes;

// Crear una nueva dirección para un cliente
exports.create = async (req, res) => {
  try {
    const { id_cliente, direccion, ciudad, estado, codigo_postal, pais, es_predeterminada } = req.body;

    if (!id_cliente || !direccion) {
      return res.status(400).json({ message: "id_cliente y direccion son obligatorios." });
    }

    const clienteExiste = await Cliente.findByPk(id_cliente);
    if (!clienteExiste) {
      return res.status(400).json({ message: `No existe un cliente con id ${id_cliente}.` });
    }

    const nuevaDireccion = await DireccionCliente.create({
      id_cliente,
      direccion,
      ciudad,
      estado,
      codigo_postal,
      pais,
      es_predeterminada: es_predeterminada || false
    });

    res.status(201).json(nuevaDireccion);
  } catch (error) {
    res.status(500).json({ message: "Error al crear la dirección.", error: error.message });
  }
};

// Listar todas las direcciones de un cliente específico
exports.findAllByCliente = async (req, res) => {
  try {
    const { id_cliente } = req.params;
    const direcciones = await DireccionCliente.findAll({ where: { id_cliente } });
    res.status(200).json(direcciones);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las direcciones.", error: error.message });
  }
};

// Obtener una dirección por su id
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const direccion = await DireccionCliente.findByPk(id);

    if (!direccion) {
      return res.status(404).json({ message: `No se encontró una dirección con id ${id}.` });
    }

    res.status(200).json(direccion);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener la dirección.", error: error.message });
  }
};

// Actualizar una dirección
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const [filasActualizadas] = await DireccionCliente.update(req.body, {
      where: { id_direccion: id }
    });

    if (filasActualizadas === 0) {
      return res.status(404).json({ message: `No se encontró una dirección con id ${id}, o no había cambios que aplicar.` });
    }

    res.status(200).json({ message: "Dirección actualizada correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar la dirección.", error: error.message });
  }
};

// Eliminar una dirección
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const filasEliminadas = await DireccionCliente.destroy({
      where: { id_direccion: id }
    });

    if (filasEliminadas === 0) {
      return res.status(404).json({ message: `No se encontró una dirección con id ${id}.` });
    }

    res.status(200).json({ message: "Dirección eliminada correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar la dirección.", error: error.message });
  }
};

// Helper para el middleware isEmpleadoODueno: dado un id_direccion (route param),
// devuelve el id_usuario dueño de esa dirección (a través del cliente).
exports.obtenerIdUsuarioDeDireccion = async (req) => {
  const direccion = await DireccionCliente.findByPk(req.params.id);
  if (!direccion) return null;
  const cliente = await Cliente.findByPk(direccion.id_cliente);
  return cliente ? cliente.id_usuario : null;
};