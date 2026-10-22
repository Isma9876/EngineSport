const { authJwt } = require("../middlewares");
const {
  obtenerIdUsuarioDePedido,
  obtenerIdUsuarioDeClientePorParam,
  obtenerIdUsuarioDeClienteEnBody,
} = require("../middlewares/pedidoAuth.js");
const controller = require("../controllers/pedido.controller.js");

module.exports = (app) => {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization");
    next();
  });

  const router = require("express").Router();

  // Crear pedido: un cliente solo para sí mismo; un empleado para cualquiera
  router.post("/", [authJwt.verifyToken, authJwt.isEmpleadoODueno(obtenerIdUsuarioDeClienteEnBody)], controller.crearPedido);

    // Expiración de reservas para un cron externo (se autentica con x-cron-secret, no con JWT)
  router.post("/expirar", controller.expirarReservas);
  
  // Listar todos los pedidos: solo empleados
  router.get("/", [authJwt.verifyToken, authJwt.isEmpleado], controller.getPedidos);

    // Historial del cliente autenticado
  router.get("/mis-pedidos", [authJwt.verifyToken], controller.getMisPedidos);

    // Comprobante de pago (PDF): empleado o dueño del pedido
  router.get(
    "/:id/comprobante",
    [authJwt.verifyToken, authJwt.isEmpleadoODueno(obtenerIdUsuarioDePedido)],
    controller.getComprobante
  );
  
  // Pedidos de un cliente: empleado o el propio cliente
  router.get(
    "/cliente/:idCliente",
    [authJwt.verifyToken, authJwt.isEmpleadoODueno(obtenerIdUsuarioDeClientePorParam)],
    controller.getPedidosByCliente
  );

  // Un pedido: empleado o dueño del pedido
  router.get("/:id", [authJwt.verifyToken, authJwt.isEmpleadoODueno(obtenerIdUsuarioDePedido)], controller.getPedidoById);

  // Cambiar estado: empleado o dueño (el controlador limita al cliente a cancelar)
  router.put(
    "/:id/estado",
    [authJwt.verifyToken, authJwt.isEmpleadoODueno(obtenerIdUsuarioDePedido)],
    controller.actualizarEstadoPedido
  );

    // Reembolsar un pedido pagado (aún no enviado): solo empleados
  router.post("/:id/reembolso", [authJwt.verifyToken, authJwt.isEmpleado], controller.reembolsarPedido);
  
  app.use("/api/pedidos", router);
};