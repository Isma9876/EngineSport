// app/controllers/categoria.controller.js
const db = require("../models");
const Categoria = db.categorias;

// Crear una nueva categoría
exports.create = async (req, res) => {
  try {
    const { nombre, descripcion, id_categoria_padre } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: "El nombre es obligatorio." });
    }

    const nuevaCategoria = await Categoria.create({
      nombre,
      descripcion,
      id_categoria_padre: id_categoria_padre || null
    });

    res.status(201).json(nuevaCategoria);
  } catch (error) {
    res.status(500).json({ message: "Error al crear la categoría.", error: error.message });
  }
};

// Listar todas las categorías (con su categoría padre y subcategorías)
exports.findAll = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      include: [
        { association: "categoriaPadre" },
        { association: "subcategorias" }
      ]
    });
    res.status(200).json(categorias);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las categorías.", error: error.message });
  }
};

// Obtener una categoría por su id
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const categoria = await Categoria.findByPk(id, {
      include: [
        { association: "categoriaPadre" },
        { association: "subcategorias" }
      ]
    });

    if (!categoria) {
      return res.status(404).json({ message: `No se encontró una categoría con id ${id}.` });
    }

    res.status(200).json(categoria);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener la categoría.", error: error.message });
  }
};

// Actualizar una categoría
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_categoria_padre } = req.body;

    const categoriaExistente = await Categoria.findByPk(id);
    if (!categoriaExistente) {
      return res.status(404).json({ message: `No se encontró una categoría con id ${id}.` });
    }

    if (id_categoria_padre !== undefined && id_categoria_padre !== null) {
      // 1. No puede ser su propio padre
      if (Number(id_categoria_padre) === Number(id)) {
        return res.status(400).json({ message: "Una categoría no puede ser su propia categoría padre." });
      }

      // 2. La categoría padre indicada debe existir
      const padreExiste = await Categoria.findByPk(id_categoria_padre);
      if (!padreExiste) {
        return res.status(400).json({ message: `No existe una categoría con id ${id_categoria_padre}.` });
      }
    }

    await categoriaExistente.update(req.body);

    res.status(200).json({ message: "Categoría actualizada correctamente.", categoria: categoriaExistente });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar la categoría.", error: error.message });
  }
};

// Eliminar una categoría
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const filasEliminadas = await Categoria.destroy({
      where: { id_categoria: id }
    });

    if (filasEliminadas === 0) {
      return res.status(404).json({ message: `No se encontró una categoría con id ${id}.` });
    }

    res.status(200).json({ message: "Categoría eliminada correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar la categoría.", error: error.message });
  }
};