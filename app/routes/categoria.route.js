// app/routes/categoria.route.js
module.exports = (app) => {
  const categorias = require("../controllers/categoria.controller.js");
  const router = require("express").Router();

  router.post("/", categorias.create);
  router.get("/", categorias.findAll);
  router.get("/:id", categorias.findOne);
  router.put("/:id", categorias.update);
  router.delete("/:id", categorias.delete);

  app.use("/api/categorias", router);
};