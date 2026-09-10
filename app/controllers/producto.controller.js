// app/controllers/producto.controller.js
const db = require("../models");
const Producto = db.productos;

// Crear un nuevo producto
exports.create = async (req, res) => {
  try {
    const { sku, nombre, descripcion, precio_costo, precio_venta, stock, stock_minimo, id_categoria, id_proveedor } = req.body;

    if (!sku || !nombre || !precio_costo || !precio_venta) {
      return res.status(400).json({ message: "sku, nombre, precio_costo y precio_venta son obligatorios." });
    }

    const nuevoProducto = await Producto.create({
      sku,
      nombre,
      descripcion,
      precio_costo,
      precio_venta,
      stock: stock || 0,
      stock_minimo: stock_minimo || 0,
      id_categoria,
      id_proveedor
    });

    res.status(201).json(nuevoProducto);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el producto.", error: error.message });
  }
};

// Listar todos los productos (con su categoría y proveedor)
exports.findAll = async (req, res) => {
  try {
    const productos = await Producto.findAll({
      include: [
        { association: "categoria" },
        { association: "proveedor" }
      ]
    });
    res.status(200).json(productos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los productos.", error: error.message });
  }
};

// Obtener un producto por su id
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findByPk(id, {
      include: [
        { association: "categoria" },
        { association: "proveedor" }
      ]
    });

    if (!producto) {
      return res.status(404).json({ message: `No se encontró un producto con id ${id}.` });
    }

    res.status(200).json(producto);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el producto.", error: error.message });
  }
};

// Actualizar un producto
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const [filasActualizadas] = await Producto.update(req.body, {
      where: { id_producto: id }
    });

    if (filasActualizadas === 0) {
      return res.status(404).json({ message: `No se encontró un producto con id ${id}, o no había cambios que aplicar.` });
    }

    res.status(200).json({ message: "Producto actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el producto.", error: error.message });
  }
};

// Eliminar un producto
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const filasEliminadas = await Producto.destroy({
      where: { id_producto: id }
    });

    if (filasEliminadas === 0) {
      return res.status(404).json({ message: `No se encontró un producto con id ${id}.` });
    }

    res.status(200).json({ message: "Producto eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el producto.", error: error.message });
  }
};