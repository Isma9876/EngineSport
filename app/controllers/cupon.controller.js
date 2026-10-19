// app/controllers/cupon.controller.js
const db = require("../models");
const { validarYCalcular, CuponError } = require("../services/cupon.service");

const Cupon = db.cupon;
const TIPOS = ["porcentaje", "monto"];
const CAMPOS_EDITABLES = [
  "codigo", "descripcion", "tipo", "valor", "vigencia_inicio",
  "vigencia_fin", "usos_maximos", "monto_minimo", "activo",
];

function validarDatos(d) {
  if (!/^[A-Z0-9_-]{3,50}$/.test(d.codigo || ""))
    return "codigo requerido (3 a 50 caracteres: letras, números, - y _).";
  if (!TIPOS.includes(d.tipo)) return "tipo debe ser 'porcentaje' o 'monto'.";
  const valor = Number(d.valor);
  if (!(valor > 0)) return "valor debe ser mayor que 0.";
  if (d.tipo === "porcentaje" && valor > 100) return "Un porcentaje no puede ser mayor que 100.";
  if (d.usos_maximos != null && !(Number.isInteger(Number(d.usos_maximos)) && Number(d.usos_maximos) > 0))
    return "usos_maximos debe ser un entero mayor que 0 (o null para ilimitado).";
  if (d.monto_minimo != null && !(Number(d.monto_minimo) >= 0))
    return "monto_minimo no puede ser negativo.";
  if (d.vigencia_inicio && d.vigencia_fin && new Date(d.vigencia_fin) <= new Date(d.vigencia_inicio))
    return "vigencia_fin debe ser posterior a vigencia_inicio.";
  return null;
}

const normalizar = (d) => ({ ...d, codigo: String(d.codigo || "").trim().toUpperCase() });

exports.crearCupon = async (req, res) => {
  try {
    const datos = normalizar(req.body);
    const error = validarDatos(datos);
    if (error) return res.status(400).json({ message: error });

    const cupon = await Cupon.create({
      codigo: datos.codigo,
      descripcion: datos.descripcion || null,
      tipo: datos.tipo,
      valor: datos.valor,
      vigencia_inicio: datos.vigencia_inicio || null,
      vigencia_fin: datos.vigencia_fin || null,
      usos_maximos: datos.usos_maximos ?? null,
      monto_minimo: datos.monto_minimo ?? 0,
    });
    return res.status(201).json(cupon);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return res.status(409).json({ message: "Ya existe un cupón con ese código." });
    console.error("crearCupon:", error);
    return res.status(500).json({ message: "Error al crear el cupón." });
  }
};

exports.listarCupones = async (req, res) => {
  try {
    const cupones = await Cupon.findAll({ order: [["id_cupon", "DESC"]] });
    return res.status(200).json(cupones);
  } catch (error) {
    console.error("listarCupones:", error);
    return res.status(500).json({ message: "Error al listar los cupones." });
  }
};

exports.obtenerCupon = async (req, res) => {
  try {
    const cupon = await Cupon.findByPk(req.params.id);
    if (!cupon) return res.status(404).json({ message: "Cupón no encontrado." });
    return res.status(200).json(cupon);
  } catch (error) {
    console.error("obtenerCupon:", error);
    return res.status(500).json({ message: "Error al obtener el cupón." });
  }
};

exports.actualizarCupon = async (req, res) => {
  try {
    const cupon = await Cupon.findByPk(req.params.id);
    if (!cupon) return res.status(404).json({ message: "Cupón no encontrado." });

    const cambios = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }
    // usos_actuales no se edita a mano: lo maneja el sistema.
    const datos = normalizar({ ...cupon.toJSON(), ...cambios });
    const error = validarDatos(datos);
    if (error) return res.status(400).json({ message: error });

    if (cambios.codigo !== undefined) cambios.codigo = datos.codigo;
    await cupon.update(cambios);
    return res.status(200).json(cupon);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return res.status(409).json({ message: "Ya existe un cupón con ese código." });
    console.error("actualizarCupon:", error);
    return res.status(500).json({ message: "Error al actualizar el cupón." });
  }
};

// No se borra físicamente: los pedidos históricos lo referencian (id_cupon).
exports.desactivarCupon = async (req, res) => {
  try {
    const cupon = await Cupon.findByPk(req.params.id);
    if (!cupon) return res.status(404).json({ message: "Cupón no encontrado." });
    await cupon.update({ activo: false });
    return res.status(200).json({ message: "Cupón desactivado.", id_cupon: cupon.id_cupon });
  } catch (error) {
    console.error("desactivarCupon:", error);
    return res.status(500).json({ message: "Error al desactivar el cupón." });
  }
};

// Vista previa para el carrito/checkout. El cálculo real se repite en crearPedido.
exports.validarCuponPublico = async (req, res) => {
  try {
    const { codigo, subtotal } = req.body;
    if (!codigo || !(Number(subtotal) > 0))
      return res.status(400).json({ message: "Se requiere codigo y subtotal mayor que 0." });

    const { cupon, descuento } = await validarYCalcular(db, codigo, subtotal);
    return res.status(200).json({
      codigo: cupon.codigo,
      tipo: cupon.tipo,
      valor: cupon.valor,
      descuento,
    });
  } catch (error) {
    if (error instanceof CuponError) return res.status(error.status).json({ message: error.message });
    console.error("validarCuponPublico:", error);
    return res.status(500).json({ message: "Error al validar el cupón." });
  }
};