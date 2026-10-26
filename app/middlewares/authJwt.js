// app/middlewares/authJwt.js
const jwt = require("jsonwebtoken");
const db = require("../models");

// Valida el token y el estado de la cuenta. NO responde: devuelve el resultado
// para que verifyToken y verifyTokenOptional decidan qué hacer con él.
//   { usuario } -> token válido y cuenta no desactivada
//   { error }   -> { status, body } con la respuesta que corresponde
//
// Los textos de "message" son los de siempre; "code" es un campo NUEVO que el
// frontend puede usar para distinguir los casos sin depender del texto:
//   TOKEN_EXPIRADO      (401) el token venció
//   TOKEN_INVALIDO      (401) el token está alterado o mal formado
//   CUENTA_DESACTIVADA  (403) el token es válido, pero la cuenta tiene activo = false
const autenticar = async (req) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: { status: 401, body: { message: "No se proporcionó un token de autenticación." } } };
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return {
      error: {
        status: 401,
        body: {
          message: "Token inválido o expirado.",
          code: err.name === "TokenExpiredError" ? "TOKEN_EXPIRADO" : "TOKEN_INVALIDO"
        }
      }
    };
  }

  // Un token vigente no basta: la cuenta podría haberse desactivado después de emitirlo.
  // Si el usuario no tiene perfil asociado, no se bloquea (igual que en el login).
  try {
    const Perfil = decoded.tipo === "empleado" ? db.empleados : db.clientes;
    const perfil = await Perfil.findOne({
      where: { id_usuario: decoded.id },
      attributes: ["activo"]
    });

    if (perfil && perfil.activo === false) {
      return {
        error: {
          status: 403,
          body: { message: "Esta cuenta está desactivada.", code: "CUENTA_DESACTIVADA" }
        }
      };
    }
  } catch (error) {
    return { error: { status: 500, body: { message: "Error al validar la sesión." } } };
  }

  return { usuario: { id: decoded.id, email: decoded.email, tipo: decoded.tipo } };
};

// Verifica que la petición traiga un token JWT válido en el header Authorization
// y que la cuenta no esté desactivada.
// Formato esperado: Authorization: Bearer <token>
// Si todo está bien, adjunta req.usuario = { id, email, tipo } y continúa.
const verifyToken = async (req, res, next) => {
  const resultado = await autenticar(req);

  if (resultado.error) {
    return res.status(resultado.error.status).json(resultado.error.body);
  }

  req.usuario = resultado.usuario;
  next();
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

// Para rutas públicas que muestran más información a usuarios con sesión (ej. el catálogo).
// - Sin header Authorization: continúa como visitante (req.usuario queda sin definir).
// - Con header Authorization: se valida igual que en verifyToken; si el token es
//   inválido o venció responde 401, para no confundirlo con un visitante.
// - Con un token válido de una cuenta DESACTIVADA: se trata como visitante. La cuenta
//   no obtiene los privilegios de su sesión, pero el catálogo público sigue funcionando
//   sin que el frontend tenga que descartar el token primero.
const verifyTokenOptional = async (req, res, next) => {
  if (!req.headers["authorization"]) {
    return next();
  }

  const resultado = await autenticar(req);

  if (resultado.error) {
    if (resultado.error.body.code === "CUENTA_DESACTIVADA") {
      return next();
    }
    return res.status(resultado.error.status).json(resultado.error.body);
  }

  req.usuario = resultado.usuario;
  next();
};

module.exports = {
  verifyToken,
  verifyTokenOptional,
  isEmpleado,
  isCliente,
  isEmpleadoODueno
};