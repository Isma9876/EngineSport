// app/controllers/producto.controller.js
const db = require("../models");
const Producto = db.productos;

// Crear un nuevo producto
exports.create = async (req, res) => {
  try {
    const { sku, nombre, descripcion, precio_costo, precio_venta, stock, stock_minimo, id_categoria, id_proveedor } = req.body;

    // 1. Campos obligatorios
    if (!sku || !nombre || precio_costo === undefined || precio_venta === undefined) {
      return res.status(400).json({ message: "sku, nombre, precio_costo y precio_venta son obligatorios." });
    }

    // 2. Ningún valor numérico puede ser negativo
    const valoresNumericos = { precio_costo, precio_venta, stock: stock || 0, stock_minimo: stock_minimo || 0 };
    for (const [campo, valor] of Object.entries(valoresNumericos)) {
      if (valor < 0) {
        return res.status(400).json({ message: `El campo ${campo} no puede ser negativo.` });
      }
    }

    // 3. El precio de venta debe ser mayor al precio de costo
    if (Number(precio_venta) <= Number(precio_costo)) {
      return res.status(400).json({ message: "El precio_venta debe ser mayor que el precio_costo." });
    }

    // 4. Si mandan id_categoria, debe existir
    if (id_categoria) {
      const categoriaExiste = await db.categorias.findByPk(id_categoria);
      if (!categoriaExiste) {
        return res.status(400).json({ message: `No existe una categoría con id ${id_categoria}.` });
      }
    }

    // 5. Si mandan id_proveedor, debe existir
    if (id_proveedor) {
      const proveedorExiste = await db.proveedores.findByPk(id_proveedor);
      if (!proveedorExiste) {
        return res.status(400).json({ message: `No existe un proveedor con id ${id_proveedor}.` });
      }
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