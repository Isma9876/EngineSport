// app/routes/categoria.route.js
module.exports = (app) => {
  const categorias = require("../controllers/categoria.controller.js");
  const { verifyToken, isEmpleado } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Rutas públicas: cualquiera puede ver las categorías
  router.get("/", categorias.findAll);
  router.get("/:id", categorias.findOne);

  // Rutas protegidas: solo empleados autenticados
  router.post("/", [verifyToken, isEmpleado], categorias.create);
  router.put("/:id", [verifyToken, isEmpleado], categorias.update);
  router.delete("/:id", [verifyToken, isEmpleado], categorias.delete);

  app.use("/api/categorias", router);
};