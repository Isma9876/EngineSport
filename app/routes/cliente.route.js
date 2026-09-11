// app/routes/cliente.route.js
module.exports = (app) => {
  const clientes = require("../controllers/cliente.controller.js");
  const { verifyToken, isEmpleado, isEmpleadoODueno } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Nota: la creación de clientes ocurre vía POST /api/auth/register (no aquí).

  // Solo empleados pueden listar a todos los clientes.
  router.get("/", verifyToken, isEmpleado, clientes.findAll);

  // Un empleado, o el propio cliente dueño del perfil, pueden ver/editar/eliminar.
  router.get("/:id", verifyToken, isEmpleadoODueno(clientes.obtenerIdUsuarioDeCliente), clientes.findOne);
  router.put("/:id", verifyToken, isEmpleadoODueno(clientes.obtenerIdUsuarioDeCliente), clientes.update);

  // Eliminar un cliente queda reservado a empleados (acción administrativa).
  router.delete("/:id", verifyToken, isEmpleado, clientes.delete);

  app.use("/api/clientes", router);
};