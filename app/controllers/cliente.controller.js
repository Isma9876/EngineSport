// app/controllers/cliente.controller.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../models");
const Cliente = db.clientes;
const Usuario = db.usuarios;
const Direccion = db.direccionesCliente;
const Pedido = db.pedidos; // Módulo de Ventas: SOLO LECTURA (count), no se modifica nada ahí.

// ---------------------------------------------------------------------------
// Helpers internos (no se exportan)
// ---------------------------------------------------------------------------

// Un cliente con pedidos pendientes o pagados (aún no enviados) no debe
// desactivarse: su dirección de envío se anonimiza y el pedido no podría entregarse.
// Si el equipo prefiere quitar esta restricción, basta con borrar este helper
// y sus dos usos (en "delete" y en "eliminarMiCuenta").
async function tienePedidosEnCurso(cliente, t) {
  const total = await Pedido.count({
    where: { id_cliente: cliente.id, estado: ["pendiente", "pagado"] },
    transaction: t
  });
  return total > 0;
}

// Desactiva la cuenta SIN borrar filas (conserva pedidos, pagos y estadísticas)
// y anonimiza los datos personales.
async function desactivarYAnonimizar(cliente, t) {
  await cliente.update(
    { activo: false, nombre: "Cuenta", apellido: "eliminada", telefono: null },
    { transaction: t }
  );

  // Password aleatorio: nadie puede volver a entrar con esta cuenta,
  // y el email original queda libre para un registro nuevo.
  const passwordInutilizable = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);
  await Usuario.update(
    { email: `eliminado_${cliente.id}@enginesport.invalid`, password: passwordInutilizable },
    { where: { id_usuario: cliente.id_usuario }, transaction: t }
  );

  // Se conservan ciudad, estado y país (útiles para estadísticas);
  // se elimina lo que identifica a la persona.
  await Direccion.update(
    { direccion: "Dirección eliminada", codigo_postal: null, es_predeterminada: false },
    { where: { id_cliente: cliente.id }, transaction: t }
  );
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

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

// Desactivar un cliente (solo empleados).
// Ya NO borra filas: conserva pedidos y pagos, anonimiza datos personales
// y libera el email. Antes era un destroy() que fallaba por la FK de direcciones
// y dejaba el usuario huérfano.
exports.delete = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const cliente = await Cliente.findByPk(req.params.id, { transaction: t });

    if (!cliente) {
      await t.rollback();
      return res.status(404).json({ message: `No se encontró un cliente con id ${req.params.id}.` });
    }

    if (await tienePedidosEnCurso(cliente, t)) {
      await t.rollback();
      return res.status(409).json({
        message: "El cliente tiene pedidos pendientes o pagados sin enviar. Resuélvelos antes de desactivar la cuenta."
      });
    }

    await desactivarYAnonimizar(cliente, t);
    await t.commit();

    res.status(200).json({ message: "Cuenta desactivada correctamente." });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al desactivar el cliente.", error: error.message });
  }
};

// El propio cliente desactiva su cuenta, confirmando su contraseña.
// Ruta: POST /api/clientes/me/eliminar-cuenta  (body: { "password": "..." })
exports.eliminarMiCuenta = async (req, res) => {
  const { password } = req.body;

  if (req.usuario.tipo !== "cliente") {
    return res.status(403).json({ message: "Solo los clientes pueden eliminar su cuenta por esta vía." });
  }

  if (!password) {
    return res.status(400).json({ message: "Debes confirmar tu contraseña." });
  }

  const t = await db.sequelize.transaction();
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, { transaction: t });
    const cliente = await Cliente.findOne({ where: { id_usuario: req.usuario.id }, transaction: t });

    if (!usuario || !cliente) {
      await t.rollback();
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      await t.rollback();
      return res.status(401).json({ message: "Contraseña incorrecta." });
    }

    if (await tienePedidosEnCurso(cliente, t)) {
      await t.rollback();
      return res.status(409).json({
        message: "Tienes pedidos pendientes o pagados sin enviar. Podrás eliminar tu cuenta cuando se completen."
      });
    }

    await desactivarYAnonimizar(cliente, t);
    await t.commit();

    res.status(200).json({ message: "Tu cuenta fue desactivada." });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al eliminar la cuenta.", error: error.message });
  }
};

// Helper para el middleware isEmpleadoODueno: dado un id_cliente (route param),
// devuelve el id_usuario dueño de ese perfil.
exports.obtenerIdUsuarioDeCliente = async (req) => {
  const cliente = await Cliente.findByPk(req.params.id);
  return cliente ? cliente.id_usuario : null;
};