// app/routes/listaNegra.route.js
module.exports = (app) => {
  const listaNegra = require("../controllers/listaNegra.controller.js");
  const { verifyToken, isEmpleado } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Todo el módulo es exclusivo de empleados.

  // Bloquear una cuenta de cliente (body: { "id_usuario": 12, "motivo": "..." }).
  router.post("/", verifyToken, isEmpleado, listaNegra.create);

  // Listar bloqueos (por defecto solo activos; ?activo=false o ?activo=todos).
  router.get("/", verifyToken, isEmpleado, listaNegra.findAll);

  // Desbloquear (activo = false, conserva el historial). El :id es el del bloqueo.
  router.delete("/:id", verifyToken, isEmpleado, listaNegra.delete);

  app.use("/api/lista-negra", router);
};