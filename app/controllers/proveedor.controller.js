// app/controllers/proveedor.controller.js
const db = require("../models");
const Proveedor = db.proveedores;

// Crear un nuevo proveedor
exports.create = async (req, res) => {
  try {
    const { nombre_empresa, contacto, telefono, email, direccion } = req.body;

    if (!nombre_empresa) {
      return res.status(400).json({ message: "El nombre de la empresa es obligatorio." });
    }

    const nuevoProveedor = await Proveedor.create({
      nombre_empresa,
      contacto,
      telefono,
      email,
      direccion
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
    const { id } = req.params;
    const proveedor = await Proveedor.findByPk(id);

    if (!proveedor) {
      return res.status(404).json({ message: `No se encontró un proveedor con id ${id}.` });
    }

    res.status(200).json(proveedor);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el proveedor.", error: error.message });
  }
};

// Actualizar un proveedor
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const [filasActualizadas] = await Proveedor.update(req.body, {
      where: { id_proveedor: id }
    });

    if (filasActualizadas === 0) {
      return res.status(404).json({ message: `No se encontró un proveedor con id ${id}, o no había cambios que aplicar.` });
    }

    res.status(200).json({ message: "Proveedor actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el proveedor.", error: error.message });
  }
};

// Eliminar un proveedor
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const filasEliminadas = await Proveedor.destroy({
      where: { id_proveedor: id }
    });

    if (filasEliminadas === 0) {
      return res.status(404).json({ message: `No se encontró un proveedor con id ${id}.` });
    }

    res.status(200).json({ message: "Proveedor eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el proveedor.", error: error.message });
  }
};