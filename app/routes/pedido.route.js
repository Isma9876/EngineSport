// app/routes/pedido.route.js
const { authJwt } = require("../middlewares");
const controller = require("../controllers/pedido.controller.js");

module.exports = (app) => {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization");
    next();
  });

  const router = require("express").Router();

  router.post("/", [authJwt.verifyToken], controller.crearPedido);
  router.get("/", [authJwt.verifyToken], controller.getPedidos);
  router.get("/:id", [authJwt.verifyToken], controller.getPedidoById);
  router.get("/cliente/:idCliente", [authJwt.verifyToken], controller.getPedidosByCliente);
  router.put("/:id/estado", [authJwt.verifyToken], controller.actualizarEstadoPedido);

  app.use("/api/pedidos", router);
};