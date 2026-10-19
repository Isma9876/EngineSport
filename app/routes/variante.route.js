// app/routes/variante.route.js
module.exports = (app) => {
  const variantes = require("../controllers/variante.controller.js");
  const { verifyToken, isEmpleado } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Todas las rutas de variantes son solo para empleados autenticados
  router.post("/productos/:id/variantes", [verifyToken, isEmpleado], variantes.create);
  router.put("/variantes/:id", [verifyToken, isEmpleado], variantes.update);
  router.delete("/variantes/:id", [verifyToken, isEmpleado], variantes.delete);

  app.use("/api", router);
};