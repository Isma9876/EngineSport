// app/routes/proveedor.route.js
module.exports = (app) => {
  const proveedores = require("../controllers/proveedor.controller.js");
  const { verifyToken, isEmpleado } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Todas las rutas de proveedores son internas: solo empleados autenticados
  router.get("/", [verifyToken, isEmpleado], proveedores.findAll);
  router.get("/:id", [verifyToken, isEmpleado], proveedores.findOne);
  router.post("/", [verifyToken, isEmpleado], proveedores.create);
  router.put("/:id", [verifyToken, isEmpleado], proveedores.update);
  router.delete("/:id", [verifyToken, isEmpleado], proveedores.delete);

  app.use("/api/proveedores", router);
};