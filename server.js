// server.js

// IMPORTANTE: dotenv debe cargarse ANTES que cualquier require que dependa de process.env
// (por eso "./app/models" se importa después de esta línea)
const dotenv = require("dotenv");
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const db = require("./app/models");

// Probamos la conexión a la base de datos (sin crear tablas todavía, solo verificar que conecta)
db.sequelize
  .authenticate()
  .then(() => {
    console.log("✅ Conexión a la base de datos (Neon) exitosa.");
  })
  .catch((err) => {
    console.error("❌ No se pudo conectar a la base de datos:", err.message);
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