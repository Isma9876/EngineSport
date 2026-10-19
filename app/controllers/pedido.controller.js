const db = require("../models");
const { expirarPedidosVencidos, cancelarPedidoPendiente } = require("../services/reserva.service.js");
const { validarYCalcular, round2 } = require("../services/cupon.service.js");
const PDFDocument = require("pdfkit");

const Pedido = db.pedidos;
const DetallePedido = db.detallePedidos;
const Producto = db.productos;
const MovimientoInventario = db.movimientosInventario;
const DireccionCliente = db.direccionesCliente;
const sequelize = db.sequelize;

const IMPUESTO_RATE = 0.12; // IVA Guatemala 12% — ajustar si el equipo decide otro valor
const ENVIO_COSTO = Number(process.env.ENVIO_COSTO) || 0;
const ENVIO_GRATIS_DESDE = Number(process.env.ENVIO_GRATIS_DESDE) || 0; // 0 = sin envío gratis

// POST /api/pedidos
// body: { id_cliente, id_direccion_envio, id_empleado?, codigo_cupon?, items: [{ id_producto, cantidad }] }
// La ruta ya validó que el cliente autenticado sea el dueño de id_cliente (o un empleado).
exports.crearPedido = async (req, res) => {
  const { id_cliente, id_direccion_envio, id_empleado, items, codigo_cupon } = req.body;

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

    let subtotal = 0;
    const detalles = [];
    const movimientos = [];

    // Orden fijo por producto para evitar deadlocks entre pedidos simultáneos
    const itemsOrdenados = [...items].sort((a, b) => a.id_producto - b.id_producto);

    for (const item of itemsOrdenados) {
      if (!item.id_producto || !Number.isInteger(item.cantidad) || item.cantidad <= 0) {
        throw { status: 400, message: "Cada item requiere id_producto y una cantidad entera > 0." };
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

      movimientos.push({
        id_producto: producto.id,
        cantidad: item.cantidad,
      });

      producto.stock -= item.cantidad;
      await producto.save({ transaction: t });
    }

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

    const base = round2(subtotal - descuento);
    const impuestos = round2(base * IMPUESTO_RATE);
    // Envío: tarifa fija sin IVA; gratis si (subtotal - descuento) alcanza el umbral
    const costoEnvio = ENVIO_GRATIS_DESDE > 0 && base >= ENVIO_GRATIS_DESDE ? 0 : ENVIO_COSTO;
    const total = round2(base + impuestos + costoEnvio);

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
// El producto se limita a id y nombre para no exponer precio_costo ni datos del proveedor.
exports.getPedidoById = async (req, res) => {
  try {
    const pedido = await Pedido.findByPk(req.params.id, {
      include: [
        { model: DetallePedido, as: "detalles", include: [{ model: Producto, attributes: ["id", "nombre"] }] },
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
        { model: DetallePedido, as: "detalles", include: [{ model: Producto, attributes: ["id", "nombre"] }] },
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
      include: [{ model: DetallePedido, as: "detalles", include: [{ model: Producto, attributes: ["id", "nombre"] }] }],
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
      doc.text(d.producto?.nombre || `Producto ${d.id_producto}`, xNombre, y, { width: 260 });
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
