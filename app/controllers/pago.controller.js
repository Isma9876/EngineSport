// app/controllers/pago.controller.js
const Stripe = require("stripe");
const db = require("../models");
const Pedido = db.pedidos;
const Pago = db.pagos;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/pagos/crear-sesion
exports.crearSesionPago = async (req, res) => {
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
      return res.status(400).json({ message: `El pedido ya no está en estado pendiente (estado actual: ${pedido.estado}).` });
    }

    const montoCentavos = Math.round(parseFloat(pedido.total) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gtq",
            product_data: { name: `Pedido #${pedido.id_pedido}` },
            unit_amount: montoCentavos,
          },
          quantity: 1,
        },
      ],
      metadata: { id_pedido: String(pedido.id_pedido) },
      success_url: `${process.env.FRONTEND_URL}/pago-exitoso?pedido=${pedido.id_pedido}`,
      cancel_url: `${process.env.FRONTEND_URL}/pago-cancelado?pedido=${pedido.id_pedido}`,
    });

    const [pago] = await Pago.findOrCreate({
      where: { id_pedido: pedido.id_pedido },
      defaults: {
        id_pedido: pedido.id_pedido,
        metodo_pago: "stripe",
        monto: pedido.total,
        estado_pago: "pendiente",
        referencia_transaccion: session.id,
      },
    });

    if (pago.referencia_transaccion !== session.id) {
      pago.referencia_transaccion = session.id;
      pago.monto = pedido.total;
      pago.estado_pago = "pendiente";
      await pago.save();
    }

    return res.status(200).json({ url: session.url, session_id: session.id });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al crear la sesión de pago." });
  }
};

// POST /api/pagos/webhook
exports.webhookStripe = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const idPedido = session.metadata?.id_pedido;

      if (idPedido) {
        const pago = await Pago.findOne({ where: { id_pedido: idPedido } });
        if (pago) {
          pago.estado_pago = "completado";
          pago.fecha_pago = new Date();
          pago.referencia_transaccion = session.id;
          await pago.save();
        }

        const pedido = await Pedido.findByPk(idPedido);
        if (pedido && pedido.estado === "pendiente") {
          pedido.estado = "pagado";
          await pedido.save();
        }
      }
    }

    if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
      const session = event.data.object;
      const idPedido = session.metadata?.id_pedido;
      if (idPedido) {
        const pago = await Pago.findOne({ where: { id_pedido: idPedido } });
        if (pago) {
          pago.estado_pago = "fallido";
          await pago.save();
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
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