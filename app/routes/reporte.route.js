// app/routes/reporte.route.js
const { authJwt } = require("../middlewares");
const controller = require("../controllers/reporte.controller.js");

module.exports = (app) => {
  const router = require("express").Router();

  router.get("/ventas-mensuales", [authJwt.verifyToken, authJwt.isEmpleado], controller.ventasMensuales);
  router.get("/estado-existencias", [authJwt.verifyToken, authJwt.isEmpleado], controller.estadoExistencias);
  router.get("/productos-mas-vendidos", [authJwt.verifyToken, authJwt.isEmpleado], controller.productosMasVendidos);
  router.get("/movimientos-inventario", [authJwt.verifyToken, authJwt.isEmpleado], controller.movimientosInventario);

  app.use("/api/reportes", router);
};