// app/routes/cupon.route.js
const { authJwt } = require("../middlewares");
const controller = require("../controllers/cupon.controller.js");

module.exports = (app) => {
  const router = require("express").Router();
  const soloEmpleado = [authJwt.verifyToken, authJwt.isEmpleado];

  router.post("/validar", [authJwt.verifyToken], controller.validarCuponPublico);

  router.post("/", soloEmpleado, controller.crearCupon);
  router.get("/", soloEmpleado, controller.listarCupones);
  router.get("/:id", soloEmpleado, controller.obtenerCupon);
  router.put("/:id", soloEmpleado, controller.actualizarCupon);
  router.delete("/:id", soloEmpleado, controller.desactivarCupon);

  app.use("/api/cupones", router);
};