const Stripe = require("stripe");
const { Op } = require("sequelize");
const db = require("../models");

const Pedido = db.pedidos;
const Pago = db.pagos;
const DetallePedido = db.detallePedidos;
const Variante = db.variantes;
const MovimientoInventario = db.movimientosInventario;
const sequelize = db.sequelize;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Minutos que se reserva el stock de un pedido "pendiente" antes de liberarlo.
const RESERVA_MINUTOS = parseInt(process.env.RESERVA_MINUTOS, 10) || 30;

// Cancela el PaymentIntent del pedido para que ya no se pueda pagar.
// Devuelve false si el pago ya se recibió o está en proceso: en ese caso
// NO se debe cancelar el pedido (el webhook lo marcará como pagado).
const cancelarIntentoStripe = async (pago) => {
  if (!pago || !pago.referencia_transaccion || !pago.referencia_transaccion.startsWith("pi_")) {
    return true; // nunca se generó un intent
  }

  try {
    await stripe.paymentIntents.cancel(pago.referencia_transaccion);
    return true;
  } catch (err) {
    // Si ya estaba cancelado, está bien; si está succeeded/processing, no se cancela el pedido.
    const intent = await stripe.paymentIntents.retrieve(pago.referencia_transaccion);
    return intent.status === "canceled";
  }
};

// Cancela un pedido "pendiente": cancela el intent en Stripe, restituye el stock
// de cada variante, registra los movimientos de inventario, devuelve el uso del
// cupón (si tenía) y deja el pedido en "cancelado".
// Lo usan la expiración automática y la cancelación manual.
// `motivo` queda en movimientos_inventario para distinguirlos en los reportes:
// por defecto "cancelación de pedido"; la expiración pasa "expiración de reserva".
// Devuelve: "cancelado" | "no_pendiente" | "pago_en_curso"
const cancelarPedidoPendiente = async (idPedido, motivo = "cancelación de pedido") => {
  const pedidoActual = await Pedido.findByPk(idPedido);
  if (!pedidoActual || pedidoActual.estado !== "pendiente") return "no_pendiente";

  const pagoPrevio = await Pago.findOne({ where: { id_pedido: idPedido } });

  // Primero se cancela el intent en Stripe, para que el cliente no pueda pagar
  // mientras se libera el stock.
  const puedeCancelar = await cancelarIntentoStripe(pagoPrevio);
  if (!puedeCancelar) return "pago_en_curso";

  const t = await sequelize.transaction();
  try {
    const pedido = await Pedido.findByPk(idPedido, { transaction: t, lock: t.LOCK.UPDATE });

    // Otro proceso pudo haberlo pagado o cancelado mientras tanto
    if (!pedido || pedido.estado !== "pendiente") {
      await t.commit();
      return "no_pendiente";
    }

    const detalles = await DetallePedido.findAll({
      where: { id_pedido: idPedido },
      order: [["id_variante", "ASC"]], // mismo orden que crearPedido: evita deadlocks
      transaction: t,
    });

    for (const detalle of detalles) {
      const variante = await Variante.findByPk(detalle.id_variante, { transaction: t, lock: t.LOCK.UPDATE });
      if (variante) {
        variante.stock += detalle.cantidad;
        await variante.save({ transaction: t });
      }

      await MovimientoInventario.create(
        {
          id_variante: detalle.id_variante,
          tipo_movimiento: "entrada",
          cantidad: detalle.cantidad,
          motivo,
          id_pedido: pedido.id_pedido,
        },
        { transaction: t }
      );
    }

    pedido.estado = "cancelado";
    await pedido.save({ transaction: t });

    // El pedido ya no usará el cupón: se devuelve el uso (el orden de bloqueo es
    // variantes -> cupón, igual que en crearPedido, para evitar deadlocks).
    if (pedido.id_cupon) {
      await db.cupon.decrement("usos_actuales", {
        by: 1,
        where: { id_cupon: pedido.id_cupon, usos_actuales: { [Op.gt]: 0 } },
        transaction: t,
      });
    }

    const pago = await Pago.findOne({ where: { id_pedido: idPedido }, transaction: t });
    if (pago && pago.estado_pago === "pendiente") {
      pago.estado_pago = "fallido";
      await pago.save({ transaction: t });
    }

    await t.commit();
    return "cancelado";
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// Busca pedidos "pendiente" cuya reserva venció y los cancela.
// Un error en un pedido no detiene a los demás.
const expirarPedidosVencidos = async ({ limite = 20 } = {}) => {
  const corte = new Date(Date.now() - RESERVA_MINUTOS * 60 * 1000);

  const vencidos = await Pedido.findAll({
    where: { estado: "pendiente", fecha_pedido: { [Op.lt]: corte } },
    attributes: ["id_pedido"],
    order: [["fecha_pedido", "ASC"]],
    limit: limite,
  });

  let expirados = 0;
  for (const p of vencidos) {
    try {
      if ((await cancelarPedidoPendiente(p.id_pedido, "expiración de reserva")) === "cancelado") expirados++;
    } catch (err) {
      console.error(`No se pudo expirar el pedido ${p.id_pedido}:`, err.message);
    }
  }

  return { revisados: vencidos.length, expirados };
};

// Reembolsa un pedido "pagado" (aún no enviado): devuelve el dinero en Stripe,
// restituye el stock, devuelve el uso del cupón y deja el pedido "cancelado"
// y el pago "reembolsado". Solo se llama desde la ruta de empleados.
// Devuelve { resultado: "reembolsado" | "no_encontrado" | "no_pagado" | "sin_pago", ... }
const reembolsarPedidoPagado = async (idPedido) => {
  const t = await sequelize.transaction();
  try {
    const pedido = await Pedido.findByPk(idPedido, { transaction: t, lock: t.LOCK.UPDATE });
    if (!pedido) {
      await t.commit();
      return { resultado: "no_encontrado" };
    }

    if (pedido.estado !== "pagado") {
      await t.commit();
      return { resultado: "no_pagado", estado: pedido.estado };
    }

    const pago = await Pago.findOne({ where: { id_pedido: idPedido }, transaction: t });
    if (
      !pago ||
      pago.estado_pago !== "completado" ||
      !pago.referencia_transaccion ||
      !pago.referencia_transaccion.startsWith("pi_")
    ) {
      await t.commit();
      return { resultado: "sin_pago" };
    }

    // 1) Stripe primero: si falla, no se toca nada en la base.
    let refundId = null;
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: pago.referencia_transaccion,
          reason: "requested_by_customer",
          metadata: { id_pedido: String(pedido.id_pedido) },
        },
        { idempotencyKey: `refund-${pago.referencia_transaccion}` }
      );
      if (refund.status === "failed" || refund.status === "canceled") {
        throw new Error(`Stripe no pudo completar el reembolso (estado: ${refund.status}).`);
      }
      refundId = refund.id;
    } catch (err) {
      // Si ya estaba reembolsado en Stripe, solo falta ponerse al día en la base.
      if (err.code !== "charge_already_refunded") throw err;
    }

    // 2) Base de datos: stock, movimientos, cupón, estados.
    const detalles = await DetallePedido.findAll({
      where: { id_pedido: idPedido },
      order: [["id_variante", "ASC"]], // mismo orden que crearPedido: evita deadlocks
      transaction: t,
    });

    for (const detalle of detalles) {
      const variante = await Variante.findByPk(detalle.id_variante, { transaction: t, lock: t.LOCK.UPDATE });
      if (variante) {
        variante.stock += detalle.cantidad;
        await variante.save({ transaction: t });
      }

      await MovimientoInventario.create(
        {
          id_variante: detalle.id_variante,
          tipo_movimiento: "entrada",
          cantidad: detalle.cantidad,
          motivo: "reembolso de pedido",
          id_pedido: pedido.id_pedido,
        },
        { transaction: t }
      );
    }

    pedido.estado = "cancelado";
    await pedido.save({ transaction: t });

    if (pedido.id_cupon) {
      await db.cupon.decrement("usos_actuales", {
        by: 1,
        where: { id_cupon: pedido.id_cupon, usos_actuales: { [Op.gt]: 0 } },
        transaction: t,
      });
    }

    pago.estado_pago = "reembolsado";
    await pago.save({ transaction: t });

    await t.commit();
    return { resultado: "reembolsado", refundId };
  } catch (err) {
    await t.rollback();
    console.error(`REEMBOLSO: error en el pedido ${idPedido}. Revisar Stripe y la base:`, err.message);
    throw err;
  }
};

module.exports = { cancelarPedidoPendiente, expirarPedidosVencidos, reembolsarPedidoPagado, RESERVA_MINUTOS };