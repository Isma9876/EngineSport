// app/routes/producto.route.js
module.exports = (app) => {
  const productos = require("../controllers/producto.controller.js");
  const { verifyToken, isEmpleado } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Rutas públicas: cualquiera puede ver el catálogo
  router.get("/", productos.findAll);
  router.get("/:id", productos.findOne);

  // Rutas protegidas: solo empleados autenticados
  router.post("/", [verifyToken, isEmpleado], productos.create);
  router.put("/:id", [verifyToken, isEmpleado], productos.update);
  router.delete("/:id", [verifyToken, isEmpleado], productos.delete);

  app.use("/api/productos", router);
};