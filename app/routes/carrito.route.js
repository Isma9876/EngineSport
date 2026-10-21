// app/routes/carrito.route.js
// Todas las rutas son solo para clientes autenticados; el cliente sale del token.
// (Un empleado recibe 403 desde el controlador.)
const { authJwt } = require("../middlewares/index.js");
const controller = require("../controllers/carrito.controller.js");

module.exports = (app) => {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization");
    next();
  });

  const router = require("express").Router();

  router.get("/", [authJwt.verifyToken], controller.getCarrito);
  router.post("/items", [authJwt.verifyToken], controller.agregarItem);
  router.put("/items/:id_variante", [authJwt.verifyToken], controller.actualizarItem);
  router.delete("/items/:id_variante", [authJwt.verifyToken], controller.quitarItem);
  router.delete("/", [authJwt.verifyToken], controller.vaciarCarrito);

  app.use("/api/carrito", router);
};