// app/routes/pago.route.js
const { authJwt } = require("../middlewares");
const controller = require("../controllers/pago.controller.js");

module.exports = (app) => {
  const router = require("express").Router();

  router.post("/crear-sesion", [authJwt.verifyToken], controller.crearSesionPago);
  router.get("/", [authJwt.verifyToken], controller.getAllPagos);
  router.get("/pedido/:idPedido", [authJwt.verifyToken], controller.getPagoByPedido);

  app.use("/api/pagos", router);
};