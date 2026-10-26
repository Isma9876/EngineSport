// app/controllers/categoria.controller.js
const db = require("../models");
const Categoria = db.categorias;
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

// ¿nuevoPadre es la propia categoría o una de sus descendientes? (subiendo por la cadena de padres)
const crearCiclo = async (idCategoria, idNuevoPadre) => {
  const visitados = new Set();
  let actual = idNuevoPadre;
  while (actual !== null && actual !== undefined && !visitados.has(actual)) {
    if (actual === idCategoria) return true;
    visitados.add(actual);
    const fila = await Categoria.findByPk(actual);
    actual = fila ? fila.id_categoria_padre : null;
  }
  return false;
};

// Crear una nueva categoría
exports.create = async (req, res) => {
  try {
    const body = req.body || {};

    const nombre = cleanText(body.nombre);
    if (!nombre) {
      return res.status(400).json({ message: "El nombre es obligatorio." });
    }

    let idPadre = null;
    if (body.id_categoria_padre !== undefined && body.id_categoria_padre !== null) {
      idPadre = parsePositiveInt(body.id_categoria_padre, null);
      if (idPadre === null) {
        return res.status(400).json({ message: "id_categoria_padre debe ser un entero positivo o null." });
      }
      const padre = await Categoria.findByPk(idPadre);
      if (!padre) {
        return res.status(400).json({ message: `No existe una categoría con id ${idPadre}.` });
      }
    }

    const nuevaCategoria = await Categoria.create({
      nombre,
      descripcion: cleanText(body.descripcion),
      id_categoria_padre: idPadre
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
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id de la categoría debe ser un entero positivo." });
    }

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

// Actualizar una categoría (solo nombre, descripcion e id_categoria_padre)
exports.update = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id de la categoría debe ser un entero positivo." });
    }

    const categoria = await Categoria.findByPk(id);
    if (!categoria) {
      return res.status(404).json({ message: `No se encontró una categoría con id ${id}.` });
    }

    const body = req.body || {};
    const cambios = {};

    if (body.nombre !== undefined) {
      const nombre = cleanText(body.nombre);
      if (!nombre) {
        return res.status(400).json({ message: "El nombre no puede estar vacío." });
      }
      cambios.nombre = nombre;
    }

    if (body.descripcion !== undefined) {
      cambios.descripcion = cleanText(body.descripcion);
    }

    if (body.id_categoria_padre !== undefined) {
      if (body.id_categoria_padre === null) {
        cambios.id_categoria_padre = null;
      } else {
        const idPadre = parsePositiveInt(body.id_categoria_padre, null);
        if (idPadre === null) {
          return res.status(400).json({ message: "id_categoria_padre debe ser un entero positivo o null." });
        }
        if (idPadre === id) {
          return res.status(400).json({ message: "Una categoría no puede ser su propia categoría padre." });
        }
        const padre = await Categoria.findByPk(idPadre);
        if (!padre) {
          return res.status(400).json({ message: `No existe una categoría con id ${idPadre}.` });
        }
        if (await crearCiclo(id, idPadre)) {
          return res.status(400).json({
            message: "No se puede asignar ese padre: la categoría indicada es una de sus subcategorías y se crearía un ciclo."
          });
        }
        cambios.id_categoria_padre = idPadre;
      }
    }

    await categoria.update(cambios);

    res.status(200).json({ message: "Categoría actualizada correctamente.", categoria });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar la categoría.", error: error.message });
  }
};

// Eliminar una categoría que no tenga subcategorías ni productos
exports.delete = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id de la categoría debe ser un entero positivo." });
    }

    const categoria = await Categoria.findByPk(id);
    if (!categoria) {
      return res.status(404).json({ message: `No se encontró una categoría con id ${id}.` });
    }

    const totalSubcategorias = await Categoria.count({ where: { id_categoria_padre: id } });
    if (totalSubcategorias > 0) {
      return res.status(409).json({
        message: `No se puede eliminar la categoría: tiene ${totalSubcategorias} subcategoría(s). Muévelas o elimínalas primero.`
      });
    }

    const totalProductos = await Producto.count({ where: { id_categoria: id } });
    if (totalProductos > 0) {
      return res.status(409).json({
        message: `No se puede eliminar la categoría: tiene ${totalProductos} producto(s) asociado(s). Reasígnalos primero.`
      });
    }

    await categoria.destroy();

    res.status(200).json({ message: "Categoría eliminada correctamente." });
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({ message: "No se puede eliminar la categoría porque tiene datos asociados." });
    }
    res.status(500).json({ message: "Error al eliminar la categoría.", error: error.message });
  }
};