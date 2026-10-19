const Stripe = require("stripe");
const db = require("../models");
const Pedido = db.pedidos;
const Pago = db.pagos;
const sequelize = db.sequelize;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const aCentavos = (monto) => Math.round(parseFloat(monto) * 100);

// POST /api/pagos/intent
// body: { id_pedido }
// Crea (o reutiliza) el PaymentIntent del pedido y devuelve el client_secret.
// Un PaymentIntent por pedido: si el pago falla, el frontend reintenta con el mismo client_secret.
exports.crearIntentoPago = async (req, res) => {
  const { id_pedido } = req.body;

  if (!id_pedido) {
    return res.status(400).json({ message: "id_pedido es obligatorio." });
  }

  try {
    const pedido = await Pedido.findByPk(id_pedido);

    if (!pedido) {
      return res.status(404).json({ message: `Pedido con id=${id_pedido} no encontrado.` });
    }

    if (pedido.estado !== "pendiente") {
      return res.status(400).json({
        message: `El pedido ya no está en estado pendiente (estado actual: ${pedido.estado}).`,
      });
    }

    const montoCentavos = aCentavos(pedido.total);
    const pagoPrevio = await Pago.findOne({ where: { id_pedido: pedido.id_pedido } });

    let intent = null;

    // Reutilizar el PaymentIntent existente si sigue siendo utilizable
    if (pagoPrevio && pagoPrevio.referencia_transaccion && pagoPrevio.referencia_transaccion.startsWith("pi_")) {
      intent = await stripe.paymentIntents.retrieve(pagoPrevio.referencia_transaccion);

      if (intent.status === "succeeded") {
        return res.status(409).json({
          message: "El pago ya fue recibido. En unos segundos el pedido se marcará como pagado.",
        });
      }

      if (intent.status === "processing") {
        return res.status(409).json({ message: "El pago está siendo procesado. Espera unos segundos." });
      }

      if (intent.status === "canceled") {
        intent = null; // se crea uno nuevo
      } else if (intent.amount !== montoCentavos) {
        // el total del pedido cambió (ej. cupón): se actualiza el mismo intent
        intent = await stripe.paymentIntents.update(intent.id, { amount: montoCentavos });
      }
    }

    if (!intent) {
      intent = await stripe.paymentIntents.create(
        {
          amount: montoCentavos,
          currency: "gtq",
          payment_method_types: ["card"],
          metadata: { id_pedido: String(pedido.id_pedido) },
        },
        {
          // evita crear dos intents si el cliente hace doble clic
          idempotencyKey: `pi-${pedido.id_pedido}-${montoCentavos}-${pagoPrevio?.referencia_transaccion || "nuevo"}`,
        }
      );
    }

    const [pago] = await Pago.findOrCreate({
      where: { id_pedido: pedido.id_pedido },
      defaults: {
        id_pedido: pedido.id_pedido,
        metodo_pago: "stripe",
        monto: pedido.total,
        estado_pago: "pendiente",
        referencia_transaccion: intent.id,
      },
    });

    if (pago.referencia_transaccion !== intent.id || pago.estado_pago === "fallido") {
      pago.referencia_transaccion = intent.id;
      pago.monto = pedido.total;
      pago.estado_pago = "pendiente";
      await pago.save();
    }

    return res.status(200).json({
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      id_pedido: pedido.id_pedido,
      monto: pedido.total,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al crear el intento de pago." });
  }
};

// Marca el pedido como pagado. Idempotente: Stripe puede reenviar el mismo evento.
// Si el pedido ya estaba "cancelado" (ej. la reserva expiró y el stock se restituyó),
// no se reactiva: se reembolsa el pago.
const procesarPagoExitoso = async (intent) => {
  const idPedido = intent.metadata?.id_pedido;
  if (!idPedido) return;

  let reembolsar = false;
  const t = await sequelize.transaction();

  try {
    const pedido = await Pedido.findByPk(idPedido, { transaction: t, lock: t.LOCK.UPDATE });
    if (!pedido) {
      await t.commit();
      return;
    }

    let pago = await Pago.findOne({ where: { id_pedido: idPedido }, transaction: t });

    if (pago && pago.estado_pago === "reembolsado") {
      await t.commit();
      return;
    }

    if (pedido.estado === "cancelado") {
      reembolsar = true;
    } else {
      if (!pago) {
        pago = await Pago.create(
          {
            id_pedido: pedido.id_pedido,
            metodo_pago: "stripe",
            monto: pedido.total,
            estado_pago: "pendiente",
            referencia_transaccion: intent.id,
          },
          { transaction: t }
        );
      }

      if (pago.estado_pago !== "completado") {
        pago.estado_pago = "completado";
        pago.fecha_pago = new Date();
        pago.referencia_transaccion = intent.id;
        await pago.save({ transaction: t });
      }

      if (pedido.estado === "pendiente") {
        pedido.estado = "pagado";
        await pedido.save({ transaction: t });
      }
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  if (reembolsar) {
    // Si falla, se lanza el error: el webhook responde 500 y Stripe reintenta.
    await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `refund-${intent.id}` });

    const pago = await Pago.findOne({ where: { id_pedido: idPedido } });
    if (pago) {
      pago.estado_pago = "reembolsado";
      pago.referencia_transaccion = intent.id;
      await pago.save();
    }
    console.warn(`Pedido ${idPedido} estaba cancelado cuando llegó el pago ${intent.id}: reembolsado.`);
  }
};

// Un intento fallido o un intent cancelado NO restituye stock:
// el cliente puede reintentar con el mismo intent. El stock se restituye
// al cancelar el pedido o al expirar la reserva.
const marcarPagoFallido = async (intent) => {
  const idPedido = intent.metadata?.id_pedido;
  if (!idPedido) return;

  const pago = await Pago.findOne({ where: { id_pedido: idPedido } });
  if (pago && pago.estado_pago === "pendiente" && pago.referencia_transaccion === intent.id) {
    pago.estado_pago = "fallido";
    await pago.save();
  }
};

// POST /api/pagos/webhook
// IMPORTANTE: esta ruta debe montarse en server.js con express.raw({ type: "application/json" })
// ANTES del middleware express.json() global, porque Stripe necesita el body crudo para
// verificar la firma.
exports.webhookStripe = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await procesarPagoExitoso(event.data.object);
        break;

      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await marcarPagoFallido(event.data.object);
        break;

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Error al procesar el webhook:", err.message);
    return res.status(500).json({ message: err.message || "Error al procesar el webhook." });
  }
};

// GET /api/pagos/pedido/:idPedido
exports.getPagoByPedido = async (req, res) => {
  try {
    const pago = await Pago.findOne({ where: { id_pedido: req.params.idPedido } });

    if (!pago) {
      return res.status(404).json({ message: `No hay pago registrado para el pedido ${req.params.idPedido}.` });
    }

    return res.status(200).json(pago);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener el pago." });
  }
};

// GET /api/pagos
exports.getAllPagos = async (req, res) => {
  try {
    const pagos = await Pago.findAll({
      order: [["fecha_pago", "DESC"]],
    });
    return res.status(200).json(pagos);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener los pagos." });
  }
};