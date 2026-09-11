// server.js
const dotenv = require("dotenv");
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const db = require("./app/models");

db.sequelize
  .sync()
  .then(() => {
    console.log("✅ Conexión exitosa y tablas sincronizadas con la base de datos (Neon).");
  })
  .catch((err) => {
    console.error("❌ Error al sincronizar la base de datos:", err.message);
  });

// Rutas
require("./app/routes/producto.route.js")(app);
require("./app/routes/categoria.route.js")(app);
require("./app/routes/proveedor.route.js")(app);
require("./app/routes/auth.route.js")(app);
require("./app/routes/cliente.route.js")(app);
require("./app/routes/direccionCliente.route.js")(app);
require("./app/routes/empleado.route.js")(app);
// Ruta simple de prueba
app.get("/", (req, res) => {
  res.json({
    message: "EngineSport API",
    ambiente: process.env.NODE_ENV || "development"
  });
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT} [ambiente: ${process.env.NODE_ENV || "development"}]`);
});