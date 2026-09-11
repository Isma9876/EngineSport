// app/routes/proveedor.route.js
module.exports = (app) => {
  const proveedores = require("../controllers/proveedor.controller.js");
  const router = require("express").Router();

  router.post("/", proveedores.create);
  router.get("/", proveedores.findAll);
  router.get("/:id", proveedores.findOne);
  router.put("/:id", proveedores.update);
  router.delete("/:id", proveedores.delete);

  app.use("/api/proveedores", router);
};