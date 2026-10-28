// app/controllers/direccionCliente.controller.js
const db = require("../models");
const DireccionCliente = db.direccionesCliente;
const Cliente = db.clientes;
const { Op } = db.Sequelize;

const ID_MAX = 2147483647; // máximo de un INTEGER en Postgres

// Un id válido es un entero positivo. Sin esta revisión, un valor como "abc"
// llega a Postgres y termina en un 500 que expone el error interno.
const idValido = (valor) => /^[1-9]\d*$/.test(String(valor)) && Number(valor) <= ID_MAX;

// Campos que el usuario puede cambiar al editar una dirección. Se excluyen a propósito
// id_direccion e id_cliente: si no, el dueño podría mover su dirección a otro cliente.
// es_predeterminada debe ser un booleano real. Sin esta revisión, un texto como "false"
// cuenta como verdadero y marcaría la dirección como predeterminada por error.
const booleanoInvalido = (valor) => valor !== undefined && typeof valor !== "boolean";

const CAMPOS_EDITABLES = ["direccion", "ciudad", "estado", "codigo_postal", "pais", "es_predeterminada"];

// Crear una nueva dirección para un cliente.
// Un cliente solo puede crearlas para sí mismo; un empleado, para cualquiera.
// Cada cliente tiene UNA sola dirección predeterminada: la primera que crea lo es
// automáticamente, y si se crea otra con es_predeterminada = true, la anterior se desmarca.
exports.create = async (req, res) => {
  try {
    const { id_cliente, direccion, ciudad, estado, codigo_postal, pais, es_predeterminada } = req.body;

    if (!id_cliente || !direccion) {
      return res.status(400).json({ message: "id_cliente y direccion son obligatorios." });
    }

    if (!idValido(id_cliente)) {
      return res.status(400).json({ message: "id_cliente debe ser un número entero positivo." });
    }

    if (booleanoInvalido(es_predeterminada)) {
      return res.status(400).json({ message: "es_predeterminada debe ser true o false." });
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

    const t = await db.sequelize.transaction();
    try {
      const existentes = await DireccionCliente.count({ where: { id_cliente: Number(id_cliente) }, transaction: t });
      const sera_predeterminada = existentes === 0 || es_predeterminada === true;

      if (sera_predeterminada) {
        await DireccionCliente.update(
          { es_predeterminada: false },
          { where: { id_cliente: Number(id_cliente) }, transaction: t }
        );
      }

      const nuevaDireccion = await DireccionCliente.create(
        {
          id_cliente: Number(id_cliente),
          direccion,
          ciudad,
          estado,
          codigo_postal,
          pais,
          es_predeterminada: sera_predeterminada
        },
        { transaction: t }
      );

      await t.commit();
      res.status(201).json(nuevaDireccion);
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ message: "Error al crear la dirección.", error: error.message });
  }
};

// Listar todas las direcciones de un cliente específico
// (el permiso lo valida isEmpleadoODueno en la ruta).
exports.findAllByCliente = async (req, res) => {
  try {
    const { id_cliente } = req.params;
    // Orden fijo (las más antiguas primero): sin él, Postgres devuelve las filas en el orden
    // físico y la lista "salta" cada vez que se actualiza una dirección.
    const direcciones = await DireccionCliente.findAll({
      where: { id_cliente: Number(id_cliente) },
      order: [["createdAt", "ASC"], ["id", "ASC"]]
    });
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

// Actualizar una dirección (solo los campos de CAMPOS_EDITABLES).
// - es_predeterminada: true  -> las demás direcciones del mismo cliente se desmarcan.
// - es_predeterminada: false -> no se permite sobre la predeterminada actual: para cambiarla,
//   hay que marcar OTRA como predeterminada (así el cliente nunca se queda sin una).
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

    if (booleanoInvalido(cambios.es_predeterminada)) {
      return res.status(400).json({ message: "es_predeterminada debe ser true o false." });
    }

    const actual = await DireccionCliente.findByPk(Number(id));
    if (!actual) {
      return res.status(404).json({ message: `No se encontró una dirección con id ${id}.` });
    }

    if (cambios.es_predeterminada === false && actual.es_predeterminada) {
      return res.status(400).json({
        message: "No se puede quitar la dirección predeterminada. Marca otra como predeterminada."
      });
    }

    const t = await db.sequelize.transaction();
    try {
      if (cambios.es_predeterminada === true) {
        await DireccionCliente.update(
          { es_predeterminada: false },
          { where: { id_cliente: actual.id_cliente, id_direccion: { [Op.ne]: Number(id) } }, transaction: t }
        );
      }

      await DireccionCliente.update(cambios, { where: { id_direccion: Number(id) }, transaction: t });
      await t.commit();
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }

    res.status(200).json({ message: "Dirección actualizada correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar la dirección.", error: error.message });
  }
};

// Eliminar una dirección.
// Si era la predeterminada, la dirección más antigua que le quede al cliente pasa a serlo.
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const actual = await DireccionCliente.findByPk(Number(id));
    if (!actual) {
      return res.status(404).json({ message: `No se encontró una dirección con id ${id}.` });
    }

    const t = await db.sequelize.transaction();
    try {
      await DireccionCliente.destroy({ where: { id_direccion: Number(id) }, transaction: t });

      if (actual.es_predeterminada) {
        const siguiente = await DireccionCliente.findOne({
          where: { id_cliente: actual.id_cliente },
          order: [["createdAt", "ASC"]],
          transaction: t
        });
        if (siguiente) {
          await siguiente.update({ es_predeterminada: true }, { transaction: t });
        }
      }

      await t.commit();
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
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
