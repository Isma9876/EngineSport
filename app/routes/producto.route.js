// app/routes/producto.route.js
module.exports = (app) => {
  const productos = require("../controllers/producto.controller.js");
  const router = require("express").Router();

  // Crear un nuevo producto
  router.post("/", productos.create);

  // Obtener todos los productos
  router.get("/", productos.findAll);

  // Obtener un producto por id
  router.get("/:id", productos.findOne);

  // Actualizar un producto
  router.put("/:id", productos.update);

  // Eliminar un producto
  router.delete("/:id", productos.delete);

  app.use("/api/productos", router);
};