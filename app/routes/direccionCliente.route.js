// app/routes/direccionCliente.route.js
module.exports = (app) => {
  const direcciones = require("../controllers/direccionCliente.controller.js");
  const { verifyToken, isEmpleadoODueno } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  router.post("/", verifyToken, direcciones.create);
  router.get("/cliente/:id_cliente", verifyToken, direcciones.findAllByCliente);
  router.get("/:id", verifyToken, isEmpleadoODueno(direcciones.obtenerIdUsuarioDeDireccion), direcciones.findOne);
  router.put("/:id", verifyToken, isEmpleadoODueno(direcciones.obtenerIdUsuarioDeDireccion), direcciones.update);
  router.delete("/:id", verifyToken, isEmpleadoODueno(direcciones.obtenerIdUsuarioDeDireccion), direcciones.delete);

  app.use("/api/direcciones", router);
};