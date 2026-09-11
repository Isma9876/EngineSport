// app/middlewares/authJwt.js
const jwt = require("jsonwebtoken");
const db = require("../models");

// Verifica que la petición traiga un token JWT válido en el header Authorization.
// Formato esperado: Authorization: Bearer <token>
// Si es válido, adjunta req.usuario = { id, email, tipo } y continúa.
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No se proporcionó un token de autenticación." });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Token inválido o expirado." });
    }

    req.usuario = {
      id: decoded.id,
      email: decoded.email,
      tipo: decoded.tipo
    };

    next();
  });
};

// Debe usarse SIEMPRE después de verifyToken en la cadena de middlewares.
// Restringe la ruta a usuarios cuyo tipo sea "empleado".
const isEmpleado = (req, res, next) => {
  if (!req.usuario || req.usuario.tipo !== "empleado") {
    return res.status(403).json({ message: "Acción reservada para empleados autenticados." });
  }
  next();
};

// Debe usarse SIEMPRE después de verifyToken en la cadena de middlewares.
// Restringe la ruta a usuarios cuyo tipo sea "cliente".
const isCliente = (req, res, next) => {
  if (!req.usuario || req.usuario.tipo !== "cliente") {
    return res.status(403).json({ message: "Acción reservada para clientes autenticados." });
  }
  next();
};

// Permite el acceso si el usuario autenticado es empleado, O si es el mismo
// cliente dueño del recurso (compara req.usuario.id contra el id_usuario del
// registro de cliente al que se intenta acceder). Útil para rutas como
// "ver/editar mi propio perfil o mis propias direcciones".
// idUsuarioDelRecurso debe ser una función (req) => idUsuario (número o string).
const isEmpleadoODueno = (idUsuarioDelRecurso) => {
  return async (req, res, next) => {
    if (req.usuario && req.usuario.tipo === "empleado") {
      return next();
    }

    try {
      const idUsuario = await idUsuarioDelRecurso(req);

      if (idUsuario === null || idUsuario === undefined) {
        return res.status(404).json({ message: "Recurso no encontrado." });
      }

      if (String(req.usuario.id) === String(idUsuario)) {
        return next();
      }

      return res.status(403).json({ message: "No tienes permiso para acceder a este recurso." });
    } catch (error) {
      return res.status(500).json({ message: "Error al validar el permiso.", error: error.message });
    }
  };
};

module.exports = {
  verifyToken,
  isEmpleado,
  isCliente,
  isEmpleadoODueno
};