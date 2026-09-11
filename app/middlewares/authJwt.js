/**
 * CASCARÓN TEMPORAL — reemplazar por app/middlewares/authJwt.js real de Alexis
 * en cuanto esté disponible. La firma/contrato debe mantenerse igual:
 * verifyToken(req, res, next) debe adjuntar req.userId si el token es válido,
 * o responder 401/403 si no lo es.
 *
 * Este cascarón SÍ valida la firma del JWT contra JWT_SECRET (no es un stub falso
 * que deje pasar todo), pero no hace nada más allá de eso. Sirve para probar
 * tus rutas protegidas generando tú mismo un token de prueba.
 */

const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No se proporcionó token (formato esperado: Bearer <token>)." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userTipo = decoded.tipo;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token inválido o expirado." });
  }
};

module.exports = { verifyToken };