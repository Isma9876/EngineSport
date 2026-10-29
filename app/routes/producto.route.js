// app/routes/producto.route.js
module.exports = (app) => {
  const productos = require("../controllers/producto.controller.js");
  const { verifyToken, verifyTokenOptional, isEmpleado } = require("../middlewares/authJwt.js");
  const router = require("express").Router();

  // Rutas públicas: cualquiera puede ver el catálogo.
  // Con token válido de empleado, la respuesta incluye stock exacto, costo y proveedor.
  router.get("/", verifyTokenOptional, productos.findAll);
  // /filtros va antes de /:id para que "filtros" no se tome como un id
  router.get("/filtros", verifyTokenOptional, productos.getFilters);
  router.get("/:id", verifyTokenOptional, productos.findOne);

  // Rutas protegidas: solo empleados autenticados
  router.post("/", [verifyToken, isEmpleado], productos.create);
  router.put("/:id", [verifyToken, isEmpleado], productos.update);
  router.delete("/:id", [verifyToken, isEmpleado], productos.delete);

  app.use("/api/productos", router);
};