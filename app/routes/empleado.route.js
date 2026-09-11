// app/routes/empleado.route.js
module.exports = (app) => {
  const empleados = require("../controllers/empleado.controller.js");
  const { verifyToken, isEmpleado } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Todas las rutas de empleados requieren estar autenticado COMO empleado.
  router.post("/", verifyToken, isEmpleado, empleados.create);
  router.get("/", verifyToken, isEmpleado, empleados.findAll);
  router.get("/:id", verifyToken, isEmpleado, empleados.findOne);
  router.put("/:id", verifyToken, isEmpleado, empleados.update);
  router.delete("/:id", verifyToken, isEmpleado, empleados.delete);

  app.use("/api/empleados", router);
};