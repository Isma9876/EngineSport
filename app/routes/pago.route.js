const { authJwt } = require("../middlewares");
const { obtenerIdUsuarioDePedido } = require("../middlewares/pedidoAuth.js");
const controller = require("../controllers/pago.controller.js");

module.exports = (app) => {
  const router = require("express").Router();

  // El webhook (POST /api/pagos/webhook) se registra en server.js con express.raw()
  // antes de express.json(), apuntando a controller.webhookStripe.

  // Crear/reutilizar el PaymentIntent: solo el cliente dueño del pedido puede pagarlo
  router.post(
    "/intent",
    [authJwt.verifyToken, authJwt.isCliente, authJwt.isEmpleadoODueno(obtenerIdUsuarioDePedido)],
    controller.crearIntentoPago
  );

  // Listar todos los pagos: solo empleados
  router.get("/", [authJwt.verifyToken, authJwt.isEmpleado], controller.getAllPagos);

  // Pago de un pedido: empleado o dueño del pedido
  router.get(
    "/pedido/:idPedido",
    [authJwt.verifyToken, authJwt.isEmpleadoODueno(obtenerIdUsuarioDePedido)],
    controller.getPagoByPedido
  );

  app.use("/api/pagos", router);
};