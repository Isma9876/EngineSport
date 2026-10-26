// app/controllers/proveedor.controller.js
const db = require("../models");
const Proveedor = db.proveedores;
const Producto = db.productos;

// Quita espacios sobrantes; si queda vacío devuelve null
const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text === "" ? null : text;
};

// Devuelve un entero positivo, el valor por defecto si no viene, o null si es inválido
const parsePositiveInt = (value, fallback) => {
  if (value === undefined) return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

// Crear un nuevo proveedor
exports.create = async (req, res) => {
  try {
    const body = req.body || {};

    const nombreEmpresa = cleanText(body.nombre_empresa);
    if (!nombreEmpresa) {
      return res.status(400).json({ message: "El nombre de la empresa es obligatorio." });
    }

    const nuevoProveedor = await Proveedor.create({
      nombre_empresa: nombreEmpresa,
      contacto: cleanText(body.contacto),
      telefono: cleanText(body.telefono),
      email: cleanText(body.email),
      direccion: cleanText(body.direccion)
    });

    res.status(201).json(nuevoProveedor);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el proveedor.", error: error.message });
  }
};

// Listar todos los proveedores
exports.findAll = async (req, res) => {
  try {
    const proveedores = await Proveedor.findAll();
    res.status(200).json(proveedores);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los proveedores.", error: error.message });
  }
};

// Obtener un proveedor por su id
exports.findOne = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id del proveedor debe ser un entero positivo." });
    }

    const proveedor = await Proveedor.findByPk(id);
    if (!proveedor) {
      return res.status(404).json({ message: `No se encontró un proveedor con id ${id}.` });
    }

    res.status(200).json(proveedor);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el proveedor.", error: error.message });
  }
};

// Actualizar un proveedor (solo nombre_empresa, contacto, telefono, email y direccion)
exports.update = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id del proveedor debe ser un entero positivo." });
    }

    const proveedor = await Proveedor.findByPk(id);
    if (!proveedor) {
      return res.status(404).json({ message: `No se encontró un proveedor con id ${id}.` });
    }

    const body = req.body || {};
    const cambios = {};

    if (body.nombre_empresa !== undefined) {
      const nombreEmpresa = cleanText(body.nombre_empresa);
      if (!nombreEmpresa) {
        return res.status(400).json({ message: "El nombre de la empresa no puede estar vacío." });
      }
      cambios.nombre_empresa = nombreEmpresa;
    }

    for (const campo of ["contacto", "telefono", "email", "direccion"]) {
      if (body[campo] !== undefined) cambios[campo] = cleanText(body[campo]);
    }

    await proveedor.update(cambios);

    res.status(200).json({ message: "Proveedor actualizado correctamente.", proveedor });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el proveedor.", error: error.message });
  }
};

// Eliminar un proveedor que no tenga productos asociados
exports.delete = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id del proveedor debe ser un entero positivo." });
    }

    const proveedor = await Proveedor.findByPk(id);
    if (!proveedor) {
      return res.status(404).json({ message: `No se encontró un proveedor con id ${id}.` });
    }

    const totalProductos = await Producto.count({ where: { id_proveedor: id } });
    if (totalProductos > 0) {
      return res.status(409).json({
        message: `No se puede eliminar el proveedor: tiene ${totalProductos} producto(s) asociado(s). Reasígnalos primero.`
      });
    }

    await proveedor.destroy();

    res.status(200).json({ message: "Proveedor eliminado correctamente." });
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({ message: "No se puede eliminar el proveedor porque tiene datos asociados." });
    }
    res.status(500).json({ message: "Error al eliminar el proveedor.", error: error.message });
  }
};