// app/routes/cliente.route.js
module.exports = (app) => {
  const clientes = require("../controllers/cliente.controller.js");
  const { verifyToken, isEmpleado, isEmpleadoODueno } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Nota: la creación de clientes ocurre vía POST /api/auth/register (no aquí).

  // Solo empleados pueden listar clientes (por defecto solo activos; ?activo=false o ?activo=todos).
  router.get("/", verifyToken, isEmpleado, clientes.findAll);

  // El propio cliente desactiva su cuenta confirmando su contraseña (body: { "password": "..." }).
  // Usa POST y no DELETE porque algunos clientes HTTP descartan el body en un DELETE.
  router.post("/me/eliminar-cuenta", verifyToken, clientes.eliminarMiCuenta);

  // Un empleado, o el propio cliente dueño del perfil, pueden ver/editar.
  router.get("/:id", verifyToken, isEmpleadoODueno(clientes.obtenerIdUsuarioDeCliente), clientes.findOne);
  router.put("/:id", verifyToken, isEmpleadoODueno(clientes.obtenerIdUsuarioDeCliente), clientes.update);

  // Desactivar un cliente (solo activo = false, reversible) queda reservado a empleados.
  router.delete("/:id", verifyToken, isEmpleado, clientes.delete);

  app.use("/api/clientes", router);
};