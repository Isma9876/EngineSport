const db = require("../models");
const { expirarPedidosVencidos, cancelarPedidoPendiente, reembolsarPedidoPagado } = require("../services/reserva.service.js");
const { validarYCalcular, round2 } = require("../services/cupon.service.js");
const PDFDocument = require("pdfkit");
const crypto = require("crypto");

const Pedido = db.pedidos;
const DetallePedido = db.detallePedidos;
const Producto = db.productos;
const Variante = db.variantes;
const MovimientoInventario = db.movimientosInventario;
const DireccionCliente = db.direccionesCliente;
const sequelize = db.sequelize;

const { IMPUESTO_RATE, calcularTotales } = require("../services/totales.service.js");
const Carrito = db.carritos;
const DetalleCarrito = db.detalleCarrito;

// Detalle -> variante (talla, color, sku) -> producto (nombre).
// No expone precio_costo ni datos del proveedor.
const incluirVariante = {
  model: Variante,
  as: "variante",
  attributes: ["id", "sku", "talla", "color"],
  include: [{ model: Producto, as: "producto", attributes: ["id", "nombre"] }],
};

// "Camiseta running (M, Negro)"
const describirVariante = (producto, variante) => {
  const extra = [variante.talla, variante.color].filter(Boolean).join(", ");
  return extra ? `${producto.nombre} (${extra})` : producto.nombre;
};

// POST /api/pedidos
// body: { id_cliente, id_direccion_envio, id_empleado?, codigo_cupon?, items: [{ id_variante, cantidad }] }
// La ruta ya validó que el cliente autenticado sea el dueño de id_cliente (o un empleado).
exports.crearPedido = async (req, res) => {
const { id_cliente, id_direccion_envio, id_empleado, items, codigo_cupon, desde_carrito } = req.body;

  if (!id_cliente || !id_direccion_envio || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "id_cliente, id_direccion_envio e items (array no vacío) son obligatorios.",
    });
  }

  // Antes de validar el stock, se libera el de las reservas vencidas
  try {
    await expirarPedidosVencidos();
  } catch (err) {
    console.error("No se pudo liberar reservas vencidas:", err.message);
  }

  const t = await sequelize.transaction();
  try {
    // La dirección de envío debe pertenecer al cliente del pedido
    const direccion = await DireccionCliente.findByPk(id_direccion_envio, { transaction: t });
    if (!direccion || String(direccion.id_cliente) !== String(id_cliente)) {
      throw { status: 400, message: "La dirección de envío no existe o no pertenece al cliente." };
    }

    // Validar los items y unir los repetidos (la misma variante dos veces suma sus cantidades)
    const cantidadPorVariante = new Map();
    for (const item of items) {
      if (!Number.isInteger(item.id_variante) || !Number.isInteger(item.cantidad) || item.cantidad <= 0) {
        throw { status: 400, message: "Cada item requiere id_variante y una cantidad entera > 0." };
      }
      cantidadPorVariante.set(item.id_variante, (cantidadPorVariante.get(item.id_variante) || 0) + item.cantidad);
    }

    // Orden fijo por variante para evitar deadlocks entre pedidos simultáneos
    const itemsOrdenados = [...cantidadPorVariante.entries()]
      .map(([id_variante, cantidad]) => ({ id_variante, cantidad }))
      .sort((a, b) => a.id_variante - b.id_variante);

    let subtotal = 0;
    const detalles = [];
    const movimientos = [];

    for (const item of itemsOrdenados) {
      // Se bloquea SOLO la variante (donde vive el stock); el producto se lee aparte para el precio
      const variante = await Variante.findByPk(item.id_variante, { transaction: t, lock: t.LOCK.UPDATE });

      if (!variante || !variante.activo) {
        throw { status: 404, message: `La variante ${item.id_variante} no existe o no está activa.` };
      }

      const producto = await Producto.findByPk(variante.id_producto, { transaction: t });

      if (!producto || !producto.activo) {
        throw { status: 404, message: `El producto de la variante ${item.id_variante} no existe o no está activo.` };
      }

      if (variante.stock < item.cantidad) {
        throw {
          status: 400,
          message: `Stock insuficiente para "${describirVariante(producto, variante)}". Disponible: ${variante.stock}, solicitado: ${item.cantidad}.`,
        };
      }

      const precioUnitario = parseFloat(producto.precio_venta);
      const subtotalItem = round2(precioUnitario * item.cantidad);
      subtotal += subtotalItem;

      detalles.push({
        id_variante: variante.id,
        cantidad: item.cantidad,
        precio_unitario: precioUnitario,
        subtotal: subtotalItem,
      });

      movimientos.push({
        id_variante: variante.id,
        cantidad: item.cantidad,
      });

      variante.stock -= item.cantidad;
      await variante.save({ transaction: t });
    }

    subtotal = round2(subtotal);

    // Mínimo PEDIDO_TOTAL_MINIMO: aplica SOLO con cupón, sobre el total con IVA (sin envío),
    // para que un cupón no deje el total en 0 o negativo. Un pedido sin cupón no tiene
    // mínimo a propósito; no es un olvido.
    // Cupón (opcional): el servidor valida y calcula el descuento; si algo falla,
    // el rollback también devuelve el stock reservado arriba.
    let descuento = 0;
    let idCupon = null;
    if (codigo_cupon) {
      const r = await validarYCalcular(db, codigo_cupon, subtotal, t, IMPUESTO_RATE);
      descuento = r.descuento;
      idCupon = r.cupon.id_cupon;
      await r.cupon.increment("usos_actuales", { transaction: t });
    }

    const { impuestos, costoEnvio, total } = calcularTotales({ subtotal, descuento });

    // id_empleado solo lo puede indicar un empleado; un cliente no puede atribuirlo
    const idEmpleadoConfirma = req.usuario.tipo === "empleado" ? id_empleado || null : null;

    const pedido = await Pedido.create(
      {
        id_cliente,
        id_empleado: idEmpleadoConfirma,
        id_direccion_envio,
        estado: "pendiente",
        subtotal,
        id_cupon: idCupon,
        descuento,
        impuestos,
        costo_envio: costoEnvio,
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
          id_variante: m.id_variante,
          tipo_movimiento: "salida",
          cantidad: m.cantidad,
          motivo: "venta",
          id_pedido: pedido.id_pedido,
        },
        { transaction: t }
      );
    }

        // Compra hecha desde el carrito: se quitan solo las variantes compradas (misma transacción)
    if (desde_carrito === true) {
      const carrito = await Carrito.findOne({ where: { id_cliente }, transaction: t });
      if (carrito) {
        await DetalleCarrito.destroy({
          where: { id_carrito: carrito.id_carrito, id_variante: itemsOrdenados.map((i) => i.id_variante) },
          transaction: t,
        });
      }
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

// GET /api/pedidos (solo empleados)
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

// GET /api/pedidos/:id (empleado o dueño del pedido)
// Cada línea trae su variante (talla, color) y el producto con id y nombre.
exports.getPedidoById = async (req, res) => {
  try {
    const pedido = await Pedido.findByPk(req.params.id, {
      include: [
        { model: DetallePedido, as: "detalles", include: [incluirVariante] },
        { model: db.pagos, attributes: ["metodo_pago", "monto", "fecha_pago", "estado_pago"] },
      ],
    });

    if (!pedido) {
      return res.status(404).json({ message: `Pedido con id=${req.params.id} no encontrado.` });
    }

    return res.status(200).json(pedido);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener el pedido." });
  }
};

// GET /api/pedidos/cliente/:idCliente (empleado o dueño del cliente)
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

// PUT /api/pedidos/:id/estado
// body: { estado: "enviado" | "cancelado", numero_guia?, transportista? }
//  - "cancelado": el dueño del pedido o un empleado, solo si el pedido sigue "pendiente".
//  - "enviado": solo empleados, solo si el pedido está "pagado". numero_guia y transportista
//    son opcionales, pero deben venir juntos.
//  - "pagado" NO se puede poner a mano: lo marca el webhook de Stripe.
//  - "cancelado" es un estado terminal.
exports.actualizarEstadoPedido = async (req, res) => {
  const { estado } = req.body;
  const estadosPermitidos = ["enviado", "cancelado"];

  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({
      message: `Estado inválido. Use uno de: ${estadosPermitidos.join(", ")}. El estado "pagado" lo marca el webhook de Stripe.`,
    });
  }

  if (req.usuario.tipo !== "empleado" && estado !== "cancelado") {
    return res.status(403).json({ message: "Un cliente solo puede cancelar sus pedidos." });
  }

  let numeroGuia = null;
  let transportista = null;
  if (estado === "enviado") {
    numeroGuia = String(req.body.numero_guia ?? "").trim() || null;
    transportista = String(req.body.transportista ?? "").trim() || null;

    if (Boolean(numeroGuia) !== Boolean(transportista)) {
      return res.status(400).json({ message: "numero_guia y transportista deben enviarse juntos." });
    }
    if ((numeroGuia && numeroGuia.length > 100) || (transportista && transportista.length > 60)) {
      return res.status(400).json({ message: "numero_guia admite hasta 100 caracteres y transportista hasta 60." });
    }
  }

  try {
    const pedido = await Pedido.findByPk(req.params.id);

    if (!pedido) {
      return res.status(404).json({ message: `Pedido con id=${req.params.id} no encontrado.` });
    }

    if (pedido.estado === "cancelado") {
      return res.status(400).json({ message: "El pedido ya está cancelado y no puede cambiar de estado." });
    }

    // ----- Cancelación -----
    if (estado === "cancelado") {
      // Si ya fue pagado o enviado, cancelar debe hacerse como reembolso, no cambiando el estado.
      if (["pagado", "enviado"].includes(pedido.estado)) {
        return res.status(400).json({
          message: `No se puede cancelar un pedido en estado "${pedido.estado}". Si ya fue pagado, debe procesarse como reembolso.`,
        });
      }

      const resultado = await cancelarPedidoPendiente(pedido.id_pedido);

      if (resultado === "pago_en_curso") {
        return res.status(409).json({
          message: "El pago de este pedido ya se recibió o se está procesando. Espera unos segundos y revisa el estado.",
        });
      }

      if (resultado === "no_pendiente") {
        return res.status(400).json({ message: "El pedido ya no está pendiente y no se pudo cancelar." });
      }

      const cancelado = await Pedido.findByPk(pedido.id_pedido);
      return res.status(200).json(cancelado);
    }

    // ----- Envío -----
    const t = await sequelize.transaction();
    try {
      const bloqueado = await Pedido.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });

      if (bloqueado.estado !== "pagado") {
        await t.rollback();
        return res.status(400).json({
          message: `Solo un pedido pagado puede marcarse como enviado (estado actual: ${bloqueado.estado}).`,
        });
      }

      bloqueado.estado = "enviado";
      bloqueado.numero_guia = numeroGuia;
      bloqueado.transportista = transportista;
      bloqueado.fecha_envio = new Date();
      await bloqueado.save({ transaction: t });
      await t.commit();

      return res.status(200).json(bloqueado);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al actualizar el estado del pedido." });
  }
};

// GET /api/pedidos/mis-pedidos?page=1&limit=10&estado=enviado
// El cliente sale del token; no se acepta id_cliente por parámetro.
exports.getMisPedidos = async (req, res) => {
  try {
    if (req.usuario.tipo !== "cliente") {
      return res.status(403).json({ message: "Solo un cliente tiene historial de pedidos propio." });
    }

    const idUsuario = req.usuario.id ?? req.usuario.id_usuario;
    const cliente = await db.clientes.findOne({ where: { id_usuario: idUsuario } });
    if (!cliente) {
      return res.status(404).json({ message: "No se encontró el cliente del usuario autenticado." });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const where = { id_cliente: cliente.id };
    if (req.query.estado) {
      const validos = ["pendiente", "pagado", "enviado", "cancelado"];
      if (!validos.includes(req.query.estado)) {
        return res.status(400).json({ message: `estado inválido. Use uno de: ${validos.join(", ")}.` });
      }
      where.estado = req.query.estado;
    }

    const { count, rows } = await Pedido.findAndCountAll({
      where,
      include: [
        { model: DetallePedido, as: "detalles", include: [incluirVariante] },
        { model: db.pagos, attributes: ["metodo_pago", "monto", "fecha_pago", "estado_pago"] },
      ],
      order: [["fecha_pedido", "DESC"]],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return res.status(200).json({
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      pedidos: rows,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener tu historial de pedidos." });
  }
};

// GET /api/pedidos/:id/comprobante (empleado o dueño del pedido)
// Solo para pedidos pagados o enviados. Las consultas se hacen antes de abrir el PDF,
// porque una vez que se empieza a escribir la respuesta ya no se puede devolver JSON de error.
exports.getComprobante = async (req, res) => {
  try {
    const pedido = await Pedido.findByPk(req.params.id, {
      include: [{ model: DetallePedido, as: "detalles", include: [incluirVariante] }],
    });

    if (!pedido) {
      return res.status(404).json({ message: `Pedido con id=${req.params.id} no encontrado.` });
    }

    if (!["pagado", "enviado"].includes(pedido.estado)) {
      return res.status(400).json({ message: "El comprobante solo está disponible para pedidos pagados." });
    }

    const [cliente, direccion, pago, cupon] = await Promise.all([
      db.clientes.findByPk(pedido.id_cliente),
      db.direccionesCliente.findByPk(pedido.id_direccion_envio),
      db.pagos.findOne({ where: { id_pedido: pedido.id_pedido } }),
      pedido.id_cupon ? db.cupon.findByPk(pedido.id_cupon) : null,
    ]);

    const q = (n) => `Q ${Number(n || 0).toFixed(2)}`;
    const fecha = (d) => (d ? new Date(d).toLocaleString("es-GT") : "-");

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="comprobante-pedido-${pedido.id_pedido}.pdf"`);
    doc.pipe(res);

    // Encabezado
    doc.fontSize(20).text("EngineSport", { align: "left" });
    doc.fontSize(12).text("Comprobante de pago", { align: "left" });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Pedido: #${pedido.id_pedido}`);
    doc.text(`Fecha del pedido: ${fecha(pedido.fecha_pedido)}`);
    doc.text(`Fecha de pago: ${fecha(pago?.fecha_pago)}`);
    doc.text(`Método de pago: ${pago?.metodo_pago || "-"}`);
    doc.moveDown();

    // Cliente y envío
    doc.text(`Cliente: ${cliente ? `${cliente.nombre} ${cliente.apellido}` : "-"}`);
    if (direccion) {
      doc.text(`Envío a: ${direccion.direccion}, ${direccion.ciudad}, ${direccion.estado}, ${direccion.pais}`);
    }
    if (pedido.numero_guia) {
      doc.text(`Paquetería: ${pedido.transportista || "-"}   Guía: ${pedido.numero_guia}`);
    }
    doc.moveDown();

    // Tabla de productos
    const xNombre = 50, xCant = 320, xPrecio = 380, xSub = 470;
    let y = doc.y;
    doc.font("Helvetica-Bold");
    doc.text("Producto", xNombre, y);
    doc.text("Cant.", xCant, y);
    doc.text("Precio", xPrecio, y);
    doc.text("Subtotal", xSub, y);
    doc.font("Helvetica");
    y += 18;

    for (const d of pedido.detalles) {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      const v = d.variante;
      const nombre = v?.producto ? describirVariante(v.producto, v) : `Variante ${d.id_variante}`;
      doc.text(nombre, xNombre, y, { width: 260 });
      doc.text(String(d.cantidad), xCant, y);
      doc.text(q(d.precio_unitario), xPrecio, y);
      doc.text(q(d.subtotal), xSub, y);
      y += 18;
    }

    // Totales
    y += 10;
    const linea = (etiqueta, valor, negrita = false) => {
      if (negrita) doc.font("Helvetica-Bold");
      doc.text(etiqueta, xPrecio - 20, y);
      doc.text(valor, xSub, y);
      if (negrita) doc.font("Helvetica");
      y += 16;
    };
    linea("Subtotal:", q(pedido.subtotal));
    if (Number(pedido.descuento) > 0) {
      linea(`Descuento${cupon ? ` (${cupon.codigo})` : ""}:`, `- ${q(pedido.descuento)}`);
    }
    linea("IVA (12%):", q(pedido.impuestos));
    linea("Envío:", Number(pedido.costo_envio) > 0 ? q(pedido.costo_envio) : "Gratis");
    linea("Total:", q(pedido.total), true);

    doc.end();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ message: err.message || "Error al generar el comprobante." });
    }
    res.end();
  }
};
// POST /api/pedidos/:id/reembolso (solo empleados)
// Reembolsa un pedido "pagado" que aún no se envió.
exports.reembolsarPedido = async (req, res) => {
  try {
    const r = await reembolsarPedidoPagado(req.params.id);

    if (r.resultado === "no_encontrado") {
      return res.status(404).json({ message: `Pedido con id=${req.params.id} no encontrado.` });
    }
    if (r.resultado === "no_pagado") {
      return res.status(400).json({
        message: `Solo se puede reembolsar un pedido pagado que aún no se envió (estado actual: ${r.estado}).`,
      });
    }
    if (r.resultado === "sin_pago") {
      return res.status(409).json({ message: "El pedido no tiene un pago completado que reembolsar." });
    }

    const pedido = await Pedido.findByPk(req.params.id);
    return res.status(200).json({ message: "Pedido reembolsado y cancelado.", refund_id: r.refundId, pedido });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al reembolsar el pedido." });
  }
};
// POST /api/pedidos/expirar
// Lo llama un cron externo cada pocos minutos. No usa JWT: se autentica con el header
// x-cron-secret, que debe coincidir con CRON_SECRET. Sin CRON_SECRET configurado, siempre responde 401.
const hashSecreto = (s) => crypto.createHash("sha256").update(String(s)).digest();

exports.expirarReservas = async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  const recibido = req.get("x-cron-secret") || "";

  if (!secreto || !crypto.timingSafeEqual(hashSecreto(recibido), hashSecreto(secreto))) {
    return res.status(401).json({ message: "No autorizado." });
  }

  try {
    const resultado = await expirarPedidosVencidos({ limite: 100 });
    return res.status(200).json(resultado);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al expirar reservas." });
  }
};