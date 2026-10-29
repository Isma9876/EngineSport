// app/controllers/producto.controller.js
const db = require("../models");
const Producto = db.productos;
const Variante = db.variantes;
const { Op, fn, col, where: sqlWhere } = db.Sequelize;
const { registrarStockInicial } = require("../services/inventario.service.js");

// Postgres: 23001 (restrict_violation) y 23503 (foreign_key_violation) llegan a veces sin el nombre de error de Sequelize
const esErrorFK = (error) =>
  error.name === "SequelizeForeignKeyConstraintError" ||
  ["23001", "23503"].includes(error.parent?.code) ||
  ["23001", "23503"].includes(error.original?.code);

// Quita espacios sobrantes; si queda vacío devuelve null
const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text === "" ? null : text;
};

// Crear un nuevo producto junto con sus variantes
exports.create = async (req, res) => {
  try {
    const { nombre, descripcion, marca, precio_costo, precio_venta, id_categoria, id_proveedor, variantes } = req.body;

    // 1. Campos obligatorios
    const nombreLimpio = cleanText(nombre);
    if (!nombreLimpio || precio_costo === undefined || precio_venta === undefined) {
      return res.status(400).json({ message: "nombre, precio_costo y precio_venta son obligatorios." });
    }

    // 2. Todo producto necesita al menos una variante
    if (!Array.isArray(variantes) || variantes.length === 0) {
      return res.status(400).json({ message: "El producto debe tener al menos una variante." });
    }

    // 3. Los precios deben ser números no negativos (un valor vacío o null no cuenta como 0)
    for (const [campo, valor] of Object.entries({ precio_costo, precio_venta })) {
      if (valor === null || valor === "" || Number.isNaN(Number(valor)) || Number(valor) < 0) {
        return res.status(400).json({ message: `El campo ${campo} debe ser un número no negativo.` });
      }
    }

    // 4. El precio de venta debe ser mayor al precio de costo
    if (Number(precio_venta) <= Number(precio_costo)) {
      return res.status(400).json({ message: "El precio_venta debe ser mayor que el precio_costo." });
    }

    // 5. Si mandan id_categoria, debe existir
    if (id_categoria) {
      const categoriaExiste = await db.categorias.findByPk(id_categoria);
      if (!categoriaExiste) {
        return res.status(400).json({ message: `No existe una categoría con id ${id_categoria}.` });
      }
    }

    // 6. Si mandan id_proveedor, debe existir
    if (id_proveedor) {
      const proveedorExiste = await db.proveedores.findByPk(id_proveedor);
      if (!proveedorExiste) {
        return res.status(400).json({ message: `No existe un proveedor con id ${id_proveedor}.` });
      }
    }

    // 7. Validar y limpiar cada variante
    const variantesLimpias = [];
    const skusVistos = new Set();
    const combinacionesVistas = new Set();

    for (const [index, item] of variantes.entries()) {
      const posicion = index + 1;

      if (typeof item !== "object" || item === null) {
        return res.status(400).json({ message: `La variante ${posicion} no es válida.` });
      }

      const sku = cleanText(item.sku);
      if (!sku) {
        return res.status(400).json({ message: `La variante ${posicion} necesita un sku.` });
      }

      const stock = item.stock === undefined ? 0 : Number(item.stock);
      const stockMinimo = item.stock_minimo === undefined ? 0 : Number(item.stock_minimo);
      if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(stockMinimo) || stockMinimo < 0) {
        return res.status(400).json({ message: `El stock y el stock_minimo de la variante ${posicion} deben ser enteros no negativos.` });
      }

      const talla = cleanText(item.talla);
      const color = cleanText(item.color);

      if (skusVistos.has(sku)) {
        return res.status(400).json({ message: `El sku ${sku} está repetido en la solicitud.` });
      }
      const combinacion = `${talla || ""}|${color || ""}`;
      if (combinacionesVistas.has(combinacion)) {
        return res.status(400).json({ message: `La variante ${posicion} repite una combinación de talla y color.` });
      }

      skusVistos.add(sku);
      combinacionesVistas.add(combinacion);
      variantesLimpias.push({ sku, talla, color, imagen_url: cleanText(item.imagen_url), stock, stock_minimo: stockMinimo });
    }

    // 8. Ningún sku puede existir ya en la base
    const skusExistentes = await Variante.findAll({
      where: { sku: [...skusVistos] },
      attributes: ["sku"]
    });
    if (skusExistentes.length > 0) {
      return res.status(409).json({ message: `Ya existe una variante con el sku ${skusExistentes[0].sku}.` });
    }

    // 9. Guardar producto y variantes juntos: si algo falla, no se guarda nada
    const idProductoNuevo = await db.sequelize.transaction(async (t) => {
      const nuevoProducto = await Producto.create(
        {
          nombre: nombreLimpio,
          descripcion,
          marca: cleanText(marca),
          precio_costo,
          precio_venta,
          id_categoria,
          id_proveedor
        },
        { transaction: t }
      );

            const variantesCreadas = await Variante.bulkCreate(
        variantesLimpias.map((v) => ({ ...v, id_producto: nuevoProducto.id })),
        { transaction: t, returning: true }
      );

      // El stock con el que nace cada variante queda registrado como entrada de inventario
      await registrarStockInicial(variantesCreadas, t);

      return nuevoProducto.id;
    });

    const productoCreado = await Producto.findByPk(idProductoNuevo, {
      include: [{ association: "variantes" }]
    });

    res.status(201).json(productoCreado);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Ya existe una variante con ese sku, o con esa combinación de talla y color." });
    }
    res.status(500).json({ message: "Error al crear el producto.", error: error.message });
  }
};

// ===== Lectura del catálogo =====

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const ORDENES = {
  nombre_asc: [["nombre", "ASC"]],
  nombre_desc: [["nombre", "DESC"]],
  precio_asc: [["precio_venta", "ASC"]],
  precio_desc: [["precio_venta", "DESC"]]
};

// Devuelve un entero positivo, el valor por defecto si no viene, o null si es inválido
const parsePositiveInt = (value, fallback) => {
  if (value === undefined) return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

// Para buscar texto con iLike sin que % y _ del usuario actúen como comodines
const escapeLike = (value) => String(value).trim().replace(/[\\%_]/g, "\\$&");

// Quita tildes y pasa a minúsculas, para búsquedas que ignoran acentos
const normalizarTexto = (value) =>
  String(value).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Estado de una variante según su stock
const getEstado = (stock, stockMinimo) => {
  if (stock <= 0) return "agotado";
  if (stock <= stockMinimo) return "pocas_unidades";
  return "disponible";
};

// Estado del producto: el mejor estado entre sus variantes
const getEstadoProducto = (variantes) => {
  const estados = variantes.map((v) => getEstado(v.stock, v.stock_minimo));
  if (estados.includes("disponible")) return "disponible";
  if (estados.includes("pocas_unidades")) return "pocas_unidades";
  return "agotado";
};

// Ids de una categoría y de todas sus subcategorías
const getCategoryTreeIds = async (idCategoria) => {
  const ids = new Set([Number(idCategoria)]);
  let pendientes = [Number(idCategoria)];

  while (pendientes.length > 0) {
    const hijas = await db.categorias.findAll({
      where: { id_categoria_padre: pendientes },
      attributes: ["id"]
    });
    pendientes = [];
    for (const hija of hijas) {
      if (!ids.has(hija.id)) {
        ids.add(hija.id);
        pendientes.push(hija.id);
      }
    }
  }
  return [...ids];
};

// Listar productos: una tarjeta por producto, con filtros y paginación
exports.findAll = async (req, res) => {
  try {
    const esEmpleado = req.usuario?.tipo === "empleado";
    const { categoria, marca, q, precio_min, precio_max, talla, color, disponible, orden } = req.query;

    // Paginación
    const page = parsePositiveInt(req.query.page, 1);
    const limitPedido = parsePositiveInt(req.query.limit, DEFAULT_LIMIT);
    if (page === null || limitPedido === null) {
      return res.status(400).json({ message: "page y limit deben ser enteros positivos." });
    }
    const limit = Math.min(limitPedido, MAX_LIMIT);

    // Orden
    if (orden !== undefined && !ORDENES[orden]) {
      return res.status(400).json({ message: `orden debe ser uno de: ${Object.keys(ORDENES).join(", ")}.` });
    }

    if (disponible !== undefined && disponible !== "true" && disponible !== "false") {
      return res.status(400).json({ message: "disponible debe ser true o false." });
    }

    // Filtros sobre el producto
    const where = {};
    if (!esEmpleado) where.activo = true;

    if (marca !== undefined && String(marca).trim() !== "") {
      where.marca = { [Op.iLike]: escapeLike(marca) };
    }
    if (q !== undefined && String(q).trim() !== "") {
      const patron = `%${escapeLike(normalizarTexto(q))}%`;
      where[Op.and] = [
        sqlWhere(
          fn("translate", fn("lower", col(`${Producto.name}.nombre`)), "áéíóúüñ", "aeiouun"),
          { [Op.like]: patron }
        )
      ];
    }

    if (precio_min !== undefined || precio_max !== undefined) {
      where.precio_venta = {};
      for (const [campo, valor, operador] of [
        ["precio_min", precio_min, Op.gte],
        ["precio_max", precio_max, Op.lte]
      ]) {
        if (valor === undefined) continue;
        if (valor === "" || Number.isNaN(Number(valor)) || Number(valor) < 0) {
          return res.status(400).json({ message: `${campo} debe ser un número no negativo.` });
        }
        where.precio_venta[operador] = Number(valor);
      }
      if (precio_min !== undefined && precio_max !== undefined && Number(precio_min) > Number(precio_max)) {
        return res.status(400).json({ message: "precio_min no puede ser mayor que precio_max." });
      }
    }

    if (categoria !== undefined) {
      const idCategoria = parsePositiveInt(categoria, null);
      if (idCategoria === null) {
        return res.status(400).json({ message: "categoria debe ser un id válido." });
      }
      where.id_categoria = await getCategoryTreeIds(idCategoria);
    }

    // Filtros sobre variantes (talla, color, disponibles): se buscan los productos
    // que tengan al menos una variante que cumpla TODAS las condiciones a la vez
    const hayFiltroVariante = talla !== undefined || color !== undefined || disponible === "true";
    if (hayFiltroVariante) {
      const whereVariante = {};
      if (!esEmpleado || disponible === "true") whereVariante.activo = true;
      if (talla !== undefined) whereVariante.talla = { [Op.iLike]: escapeLike(talla) };
      if (color !== undefined) whereVariante.color = { [Op.iLike]: escapeLike(color) };
      if (disponible === "true") whereVariante.stock = { [Op.gt]: 0 };

      const filas = await Variante.findAll({
        where: whereVariante,
        attributes: ["id_producto"],
        group: ["id_producto"],
        raw: true
      });
      where.id = { [Op.in]: filas.map((fila) => fila.id_producto) };
    }

    // Página de productos
    const include = [{ association: "categoria", attributes: ["id", "nombre"] }];
    if (esEmpleado) include.push({ association: "proveedor" });

    const { count, rows } = await Producto.findAndCountAll({
      where,
      include,
      order: [...ORDENES[orden || "nombre_asc"], ["id", "ASC"]],
      limit,
      offset: (page - 1) * limit
    });

    // Variantes de los productos de esta página
    const whereVariantes = { id_producto: rows.map((p) => p.id) };
    if (!esEmpleado) whereVariantes.activo = true;
    const variantes = await Variante.findAll({ where: whereVariantes, order: [["id", "ASC"]] });

    const variantesPorProducto = new Map();
    for (const variante of variantes) {
      if (!variantesPorProducto.has(variante.id_producto)) variantesPorProducto.set(variante.id_producto, []);
      variantesPorProducto.get(variante.id_producto).push(variante);
    }

    // Armar la tarjeta de cada producto
    const productos = rows.map((p) => {
      const susVariantes = variantesPorProducto.get(p.id) || [];
      const conImagen = susVariantes.find((v) => v.imagen_url);

      const tarjeta = {
        id: p.id,
        nombre: p.nombre,
        marca: p.marca,
        precio_venta: p.precio_venta,
        categoria: p.categoria,
        imagen_url: conImagen ? conImagen.imagen_url : null,
        estado: getEstadoProducto(susVariantes)
      };

      // Solo empleados: stock exacto, costo, proveedor y si está activo
      if (esEmpleado) {
        tarjeta.activo = p.activo;
        tarjeta.precio_costo = p.precio_costo;
        tarjeta.proveedor = p.proveedor;
        tarjeta.total_variantes = susVariantes.length;
        tarjeta.stock_total = susVariantes.reduce((suma, v) => suma + v.stock, 0);
      }
      return tarjeta;
    });

    res.status(200).json({
      total: count,
      page,
      limit,
      total_pages: Math.ceil(count / limit),
      productos
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los productos.", error: error.message });
  }
};

// Obtener el detalle de un producto, con todas sus variantes
exports.findOne = async (req, res) => {
  try {
    const esEmpleado = req.usuario?.tipo === "empleado";

    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id del producto debe ser un entero positivo." });
    }

    const include = [{ association: "categoria", attributes: ["id", "nombre"] }];
    if (esEmpleado) include.push({ association: "proveedor" });

    const producto = await Producto.findByPk(id, { include });

    // Un producto inactivo solo lo ve un empleado; para los demás es como si no existiera
    if (!producto || (!producto.activo && !esEmpleado)) {
      return res.status(404).json({ message: `No se encontró un producto con id ${id}.` });
    }

    const whereVariantes = { id_producto: producto.id };
    if (!esEmpleado) whereVariantes.activo = true;
    const variantes = await Variante.findAll({ where: whereVariantes, order: [["id", "ASC"]] });

    const detalle = {
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      marca: producto.marca,
      precio_venta: producto.precio_venta,
      categoria: producto.categoria,
      estado: getEstadoProducto(variantes),
      variantes: variantes.map((v) => {
        const variante = {
          id: v.id,
          sku: v.sku,
          talla: v.talla,
          color: v.color,
          imagen_url: v.imagen_url,
          estado: getEstado(v.stock, v.stock_minimo)
        };

        // Solo empleados: stock exacto y si la variante está activa
        if (esEmpleado) {
          variante.stock = v.stock;
          variante.stock_minimo = v.stock_minimo;
          variante.activo = v.activo;
        }
        return variante;
      })
    };

    // Solo empleados: costo, proveedor y si el producto está activo
    if (esEmpleado) {
      detalle.activo = producto.activo;
      detalle.precio_costo = producto.precio_costo;
      detalle.proveedor = producto.proveedor;
    }

    res.status(200).json(detalle);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el producto.", error: error.message });
  }
};

// Actualizar un producto (solo datos del producto; las variantes se editan aparte)
exports.update = async (req, res) => {
  try {
        const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id del producto debe ser un entero positivo." });
    }
    const { nombre, descripcion, marca, precio_costo, precio_venta, id_categoria, id_proveedor, activo } = req.body;
    
    const productoExistente = await Producto.findByPk(id);
    if (!productoExistente) {
      return res.status(404).json({ message: `No se encontró un producto con id ${id}.` });
    }

    const cambios = {};

    // Campos de texto
    if (nombre !== undefined) {
      const nombreLimpio = cleanText(nombre);
      if (!nombreLimpio) {
        return res.status(400).json({ message: "El nombre no puede estar vacío." });
      }
      cambios.nombre = nombreLimpio;
    }
    if (descripcion !== undefined) cambios.descripcion = descripcion;
    if (marca !== undefined) cambios.marca = cleanText(marca);

    if (activo !== undefined) {
      if (typeof activo !== "boolean") {
        return res.status(400).json({ message: "El campo activo debe ser true o false." });
      }
      cambios.activo = activo;
    }

    // Precios: deben ser números no negativos
    for (const [campo, valor] of Object.entries({ precio_costo, precio_venta })) {
      if (valor !== undefined && (valor === null || valor === "" || Number.isNaN(Number(valor)) || Number(valor) < 0)) {
        return res.status(400).json({ message: `El campo ${campo} debe ser un número no negativo.` });
      }
    }

    // Se compara con el valor nuevo o con el que ya tenía, para no dejar pasar una combinación inválida
    const costoFinal = precio_costo !== undefined ? Number(precio_costo) : Number(productoExistente.precio_costo);
    const ventaFinal = precio_venta !== undefined ? Number(precio_venta) : Number(productoExistente.precio_venta);

    if (ventaFinal <= costoFinal) {
      return res.status(400).json({ message: "El precio_venta debe ser mayor que el precio_costo." });
    }
    if (precio_costo !== undefined) cambios.precio_costo = precio_costo;
    if (precio_venta !== undefined) cambios.precio_venta = precio_venta;

    // Categoría y proveedor: si no son null, deben existir
    if (id_categoria !== undefined) {
      if (id_categoria !== null) {
        const categoriaExiste = await db.categorias.findByPk(id_categoria);
        if (!categoriaExiste) {
          return res.status(400).json({ message: `No existe una categoría con id ${id_categoria}.` });
        }
      }
      cambios.id_categoria = id_categoria;
    }

    if (id_proveedor !== undefined) {
      if (id_proveedor !== null) {
        const proveedorExiste = await db.proveedores.findByPk(id_proveedor);
        if (!proveedorExiste) {
          return res.status(400).json({ message: `No existe un proveedor con id ${id_proveedor}.` });
        }
      }
      cambios.id_proveedor = id_proveedor;
    }

    await productoExistente.update(cambios);

    const productoActualizado = await Producto.findByPk(id, {
      include: [{ association: "variantes" }]
    });

    res.status(200).json({ message: "Producto actualizado correctamente.", producto: productoActualizado });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el producto.", error: error.message });
  }
};

// Eliminar un producto (sus variantes se borran con él, salvo que ya tengan ventas o movimientos)
exports.delete = async (req, res) => {
  try {
     const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id del producto debe ser un entero positivo." });
    }
    const filasEliminadas = await Producto.destroy({
      where: { id_producto: id }
    });

    if (filasEliminadas === 0) {
      return res.status(404).json({ message: `No se encontró un producto con id ${id}.` });
    }

    res.status(200).json({ message: "Producto eliminado correctamente." });
  } catch (error) {
    if (esErrorFK(error)) {
      return res.status(409).json({
        message: "No se puede eliminar el producto porque tiene ventas o movimientos de inventario. Desactívalo con activo: false."
      });
    }
    res.status(500).json({ message: "Error al eliminar el producto.", error: error.message });
  }
};