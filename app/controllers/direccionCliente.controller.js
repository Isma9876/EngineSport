// app/controllers/direccionCliente.controller.js
const db = require("../models");
const DireccionCliente = db.direccionesCliente;
const Cliente = db.clientes;

const ID_MAX = 2147483647; // máximo de un INTEGER en Postgres

// Un id válido es un entero positivo. Sin esta revisión, un valor como "abc"
// llega a Postgres y termina en un 500 que expone el error interno.
const idValido = (valor) => /^[1-9]\d*$/.test(String(valor)) && Number(valor) <= ID_MAX;

// Campos que el usuario puede cambiar al editar una dirección. Se excluyen a propósito
// id_direccion e id_cliente: si no, el dueño podría mover su dirección a otro cliente.
const CAMPOS_EDITABLES = ["direccion", "ciudad", "estado", "codigo_postal", "pais", "es_predeterminada"];

// Crear una nueva dirección para un cliente.
// Un cliente solo puede crearlas para sí mismo; un empleado, para cualquiera.
exports.create = async (req, res) => {
  try {
    const { id_cliente, direccion, ciudad, estado, codigo_postal, pais, es_predeterminada } = req.body;

    if (!id_cliente || !direccion) {
      return res.status(400).json({ message: "id_cliente y direccion son obligatorios." });
    }

    if (!idValido(id_cliente)) {
      return res.status(400).json({ message: "id_cliente debe ser un número entero positivo." });
    }

    const cliente = await Cliente.findByPk(Number(id_cliente));
    const esEmpleado = req.usuario.tipo === "empleado";

    // Para quien no es empleado, "no existe" y "no es tuyo" dan la misma respuesta,
    // así no se puede averiguar qué ids de cliente existen.
    if (!esEmpleado && (!cliente || String(cliente.id_usuario) !== String(req.usuario.id))) {
      return res.status(403).json({ message: "No tienes permiso para crear direcciones para este cliente." });
    }

    if (!cliente) {
      return res.status(400).json({ message: `No existe un cliente con id ${id_cliente}.` });
    }

    const nuevaDireccion = await DireccionCliente.create({
      id_cliente: Number(id_cliente),
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
// (el permiso lo valida isEmpleadoODueno en la ruta).
exports.findAllByCliente = async (req, res) => {
  try {
    const { id_cliente } = req.params;
    const direcciones = await DireccionCliente.findAll({ where: { id_cliente: Number(id_cliente) } });
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

// Actualizar una dirección (solo los campos de CAMPOS_EDITABLES)
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const cambios = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ message: "No se envió ningún campo válido para actualizar." });
    }

    const [filasActualizadas] = await DireccionCliente.update(cambios, {
      where: { id_direccion: Number(id) }
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
      where: { id_direccion: Number(id) }
    });

    if (filasEliminadas === 0) {
      return res.status(404).json({ message: `No se encontró una dirección con id ${id}.` });
    }

    res.status(200).json({ message: "Dirección eliminada correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar la dirección.", error: error.message });
  }
};

// Helper para isEmpleadoODueno: dado un id_direccion (route param),
// devuelve el id_usuario dueño de esa dirección (a través del cliente).
exports.obtenerIdUsuarioDeDireccion = async (req) => {
  if (!idValido(req.params.id)) return null;
  const direccion = await DireccionCliente.findByPk(req.params.id);
  if (!direccion) return null;
  const cliente = await Cliente.findByPk(direccion.id_cliente);
  return cliente ? cliente.id_usuario : null;
};

// Helper para isEmpleadoODueno: dado un id_cliente (route param),
// devuelve el id_usuario dueño de ese perfil de cliente.
exports.obtenerIdUsuarioDeClienteParam = async (req) => {
  if (!idValido(req.params.id_cliente)) return null;
  const cliente = await Cliente.findByPk(req.params.id_cliente);
  return cliente ? cliente.id_usuario : null;
};
