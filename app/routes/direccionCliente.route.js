// app/routes/direccionCliente.route.js
module.exports = (app) => {
  const direcciones = require("../controllers/direccionCliente.controller.js");
  const { verifyToken, isEmpleadoODueno } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Un cliente solo puede crear direcciones para sí mismo (se valida dentro del controlador,
  // porque el id_cliente viene en el body). Un empleado puede crearlas para cualquiera.
  router.post("/", verifyToken, direcciones.create);

  // Un empleado, o el propio cliente dueño, pueden listar las direcciones de ese cliente.
  router.get("/cliente/:id_cliente", verifyToken, isEmpleadoODueno(direcciones.obtenerIdUsuarioDeClienteParam), direcciones.findAllByCliente);

  router.get("/:id", verifyToken, isEmpleadoODueno(direcciones.obtenerIdUsuarioDeDireccion), direcciones.findOne);
  router.put("/:id", verifyToken, isEmpleadoODueno(direcciones.obtenerIdUsuarioDeDireccion), direcciones.update);
  router.delete("/:id", verifyToken, isEmpleadoODueno(direcciones.obtenerIdUsuarioDeDireccion), direcciones.delete);

  app.use("/api/direcciones", router);
};
