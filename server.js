// server.js

const dotenv = require("dotenv");
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });

const express = require("express");
const cors = require("cors");

const app = express();

// CORS: solo los dominios de CORS_ORIGINS (separados por coma, sin "/" final).
// Sin la variable, solo se permite el frontend local de Vite.
// Las peticiones sin cabecera Origin (Thunder Client, curl, webhook de Stripe) pasan.
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false); // sin cabeceras CORS: el navegador bloquea la respuesta
    }
  })
);

const pagoController = require("./app/controllers/pago.controller.js");
app.post(
  "/api/pagos/webhook",
  express.raw({ type: "application/json" }),
  pagoController.webhookStripe
);

app.use(express.json());

const db = require("./app/models");

db.sequelize
  .sync()
  .then(() => {
    console.log("Conexión exitosa y tablas sincronizadas con la base de datos (Neon).");
  })
  .catch((err) => {
    console.error("Error al sincronizar la base de datos:", err.message);
  });

// Rutas
require("./app/routes/producto.route.js")(app);
require("./app/routes/variante.route.js")(app);
require("./app/routes/categoria.route.js")(app);
require("./app/routes/proveedor.route.js")(app);
require("./app/routes/auth.route.js")(app);
require("./app/routes/cliente.route.js")(app);
require("./app/routes/direccionCliente.route.js")(app);
require("./app/routes/empleado.route.js")(app);
require("./app/routes/pedido.route.js")(app);
require("./app/routes/carrito.route.js")(app);
require("./app/routes/pago.route.js")(app);
require("./app/routes/reporte.route.js")(app);
require("./app/routes/cupon.route")(app);
require("./app/routes/listaNegra.route.js")(app);

// Health check: responde sin tocar la base de datos (lo usa el pinger para mantener despierto a Render)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

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