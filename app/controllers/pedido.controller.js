// app/controllers/pedido.controller.js
const db = require("../models");
const Pedido = db.pedidos;
const DetallePedido = db.detallePedidos;
const Producto = db.productos;
const MovimientoInventario = db.movimientosInventario;
const sequelize = db.sequelize;

const IMPUESTO_RATE = 0.12;

// POST /api/pedidos
exports.crearPedido = async (req, res) => {
  const { id_cliente, id_direccion_envio, id_empleado, items } = req.body;

  if (!id_cliente || !id_direccion_envio || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "id_cliente, id_direccion_envio e items (array no vacío) son obligatorios.",
    });
  }

  const t = await sequelize.transaction();
  try {
    let subtotal = 0;
    const detalles = [];
    const movimientos = [];

    for (const item of items) {
      if (!item.id_producto || !item.cantidad || item.cantidad <= 0) {
        throw { status: 400, message: "Cada item requiere id_producto y cantidad > 0." };
      }

      const producto = await Producto.findByPk(item.id_producto, { transaction: t, lock: t.LOCK.UPDATE });

      if (!producto || !producto.activo) {
        throw { status: 404, message: `Producto ${item.id_producto} no existe o no está activo.` };
      }

      if (producto.stock < item.cantidad) {
        throw {
          status: 400,
          message: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}, solicitado: ${item.cantidad}.`,
        };
      }

      const precioUnitario = parseFloat(producto.precio_venta);
      const subtotalItem = precioUnitario * item.cantidad;
      subtotal += subtotalItem;

      detalles.push({
      id_producto: producto.id,
      cantidad: item.cantidad,
      precio_unitario: precioUnitario,
      subtotal: subtotalItem,
    });

      movimientos.push({ id_producto: producto.id, cantidad: item.cantidad });

      producto.stock -= item.cantidad;
      await producto.save({ transaction: t });
    }

    const impuestos = parseFloat((subtotal * IMPUESTO_RATE).toFixed(2));
    const total = parseFloat((subtotal + impuestos).toFixed(2));

    const pedido = await Pedido.create(
      {
        id_cliente,
        id_empleado: id_empleado || null,
        id_direccion_envio,
        estado: "pendiente",
        subtotal,
        impuestos,
        total,
      },
      { transaction: t }
    );

    for (const d of detalles) {
      await DetallePedido.create({ ...d, id_pedido: pedido.id_pedido }, { transaction: t });
    }

    for (const m of movimientos) {
      await MovimientoInventario.create(
        {
          id_producto: m.id_producto,
          tipo_movimiento: "salida",
          cantidad: m.cantidad,
          motivo: "venta",
          id_pedido: pedido.id_pedido,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const pedidoCompleto = await Pedido.findByPk(pedido.id_pedido, {
      include: [{ model: DetallePedido, as: "detalles" }],
    });

    return res.status(201).json(pedidoCompleto);
  } catch (err) {
    await t.rollback();
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || "Error al crear el pedido." });
  }
};

// GET /api/pedidos
exports.getPedidos = async (req, res) => {
  try {
    const pedidos = await Pedido.findAll({
      include: [{ model: DetallePedido, as: "detalles" }],
      order: [["fecha_pedido", "DESC"]],
    });
    return res.status(200).json(pedidos);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener los pedidos." });
  }
};

// GET /api/pedidos/:id
exports.getPedidoById = async (req, res) => {
  try {
    const pedido = await Pedido.findByPk(req.params.id, {
      include: [{ model: DetallePedido, as: "detalles" }],
    });

    if (!pedido) {
      return res.status(404).json({ message: `Pedido con id=${req.params.id} no encontrado.` });
    }

    return res.status(200).json(pedido);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener el pedido." });
  }
};

// GET /api/pedidos/cliente/:idCliente
exports.getPedidosByCliente = async (req, res) => {
  try {
    const pedidos = await Pedido.findAll({
      where: { id_cliente: req.params.idCliente },
      include: [{ model: DetallePedido, as: "detalles" }],
      order: [["fecha_pedido", "DESC"]],
    });
    return res.status(200).json(pedidos);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener los pedidos del cliente." });
  }
};

exports.actualizarEstadoPedido = async (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ["pendiente", "pagado", "enviado", "cancelado"];

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ message: `Estado inválido. Use uno de: ${estadosValidos.join(", ")}` });
  }

  const t = await sequelize.transaction();
  try {
    const pedido = await Pedido.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });

    if (!pedido) {
      await t.rollback();
      return res.status(404).json({ message: `Pedido con id=${req.params.id} no encontrado.` });
    }

    // Estado terminal: un pedido cancelado no puede volver a cambiar de estado.
    if (pedido.estado === "cancelado") {
      await t.rollback();
      return res.status(400).json({ message: "Este pedido ya está cancelado y no puede cambiar de estado." });
    }

    if (estado === "cancelado") {
      const detalles = await DetallePedido.findAll({ where: { id_pedido: pedido.id_pedido }, transaction: t });

      for (const detalle of detalles) {
        const producto = await Producto.findByPk(detalle.id_producto, { transaction: t, lock: t.LOCK.UPDATE });
        if (producto) {
          producto.stock += detalle.cantidad;
          await producto.save({ transaction: t });
        }

        await MovimientoInventario.create(
          {
            id_producto: detalle.id_producto,
            tipo_movimiento: "entrada",
            cantidad: detalle.cantidad,
            motivo: "ajuste de inventario",
            id_pedido: pedido.id_pedido,
          },
          { transaction: t }
        );
      }
    }

    pedido.estado = estado;
    await pedido.save({ transaction: t });
    await t.commit();

    return res.status(200).json(pedido);
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: err.message || "Error al actualizar el estado del pedido." });
  }
};