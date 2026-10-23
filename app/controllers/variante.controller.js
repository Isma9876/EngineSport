// app/controllers/variante.controller.js
const db = require("../models");
const Producto = db.productos;
const Variante = db.variantes;
const { Op } = db.Sequelize;
const { registrarStockInicial, ajustarStock, ErrorInventario } = require("../services/inventario.service.js");

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

// Un entero >= 0. Rechaza null, "" y textos (Number("") daría 0)
const isNonNegativeInteger = (value) =>
  value !== null && value !== "" && Number.isInteger(Number(value)) && Number(value) >= 0;

// ¿Ya hay una variante con esa talla y color? (null y vacío cuentan como lo mismo)
const combinacionRepetida = (variantes, talla, color) =>
  variantes.some((v) => (v.talla || "") === (talla || "") && (v.color || "") === (color || ""));

// Agregar una variante a un producto que ya existe
exports.create = async (req, res) => {
  try {
    const idProducto = parsePositiveInt(req.params.id, null);
    if (idProducto === null) {
      return res.status(400).json({ message: "El id del producto debe ser un entero positivo." });
    }

    const producto = await Producto.findByPk(idProducto);
    if (!producto) {
      return res.status(404).json({ message: `No se encontró un producto con id ${idProducto}.` });
    }

    const sku = cleanText(req.body.sku);
    if (!sku) {
      return res.status(400).json({ message: "El sku es obligatorio." });
    }

    const stock = req.body.stock === undefined ? 0 : req.body.stock;
    const stockMinimo = req.body.stock_minimo === undefined ? 0 : req.body.stock_minimo;
    if (!isNonNegativeInteger(stock) || !isNonNegativeInteger(stockMinimo)) {
      return res.status(400).json({ message: "stock y stock_minimo deben ser enteros no negativos." });
    }

    const talla = cleanText(req.body.talla);
    const color = cleanText(req.body.color);

    const skuExiste = await Variante.findOne({ where: { sku } });
    if (skuExiste) {
      return res.status(409).json({ message: `Ya existe una variante con el sku ${sku}.` });
    }

    const hermanas = await Variante.findAll({ where: { id_producto: idProducto }, attributes: ["talla", "color"] });
    if (combinacionRepetida(hermanas, talla, color)) {
      return res.status(409).json({ message: "Este producto ya tiene una variante con esa combinación de talla y color." });
    }

       // La variante y su movimiento de stock inicial se guardan juntos: si algo falla, no se guarda nada
    const nuevaVariante = await db.sequelize.transaction(async (t) => {
      const variante = await Variante.create(
        {
          id_producto: idProducto,
          sku,
          talla,
          color,
          imagen_url: cleanText(req.body.imagen_url),
          stock: Number(stock),
          stock_minimo: Number(stockMinimo)
        },
        { transaction: t }
      );

      await registrarStockInicial([variante], t);

      return variante;
    });

    res.status(201).json(nuevaVariante);
    
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Ya existe una variante con ese sku, o con esa combinación de talla y color." });
    }
    res.status(500).json({ message: "Error al crear la variante.", error: error.message });
  }
};

// Editar una variante (el stock no se edita aquí; tendrá su propio endpoint con movimiento de inventario)
exports.update = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id de la variante debe ser un entero positivo." });
    }

    const variante = await Variante.findByPk(id);
    if (!variante) {
      return res.status(404).json({ message: `No se encontró una variante con id ${id}.` });
    }

    const { sku, talla, color, imagen_url, stock_minimo, activo } = req.body;
    const cambios = {};

    if (sku !== undefined) {
      const skuLimpio = cleanText(sku);
      if (!skuLimpio) {
        return res.status(400).json({ message: "El sku no puede estar vacío." });
      }
      if (skuLimpio !== variante.sku) {
        const skuExiste = await Variante.findOne({ where: { sku: skuLimpio } });
        if (skuExiste) {
          return res.status(409).json({ message: `Ya existe una variante con el sku ${skuLimpio}.` });
        }
      }
      cambios.sku = skuLimpio;
    }

    if (talla !== undefined) cambios.talla = cleanText(talla);
    if (color !== undefined) cambios.color = cleanText(color);
    if (imagen_url !== undefined) cambios.imagen_url = cleanText(imagen_url);

    if (stock_minimo !== undefined) {
      if (!isNonNegativeInteger(stock_minimo)) {
        return res.status(400).json({ message: "stock_minimo debe ser un entero no negativo." });
      }
      cambios.stock_minimo = Number(stock_minimo);
    }

    if (activo !== undefined) {
      if (typeof activo !== "boolean") {
        return res.status(400).json({ message: "El campo activo debe ser true o false." });
      }
      cambios.activo = activo;
    }

    // Si cambia talla o color, la combinación no puede repetirse en las otras variantes del producto
    if (cambios.talla !== undefined || cambios.color !== undefined) {
      const tallaFinal = cambios.talla !== undefined ? cambios.talla : variante.talla;
      const colorFinal = cambios.color !== undefined ? cambios.color : variante.color;
      const hermanas = await Variante.findAll({
        where: { id_producto: variante.id_producto, id: { [Op.ne]: variante.id } },
        attributes: ["talla", "color"]
      });
      if (combinacionRepetida(hermanas, tallaFinal, colorFinal)) {
        return res.status(409).json({ message: "Este producto ya tiene una variante con esa combinación de talla y color." });
      }
    }

    await variante.update(cambios);

    res.status(200).json({ message: "Variante actualizada correctamente.", variante });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Ya existe una variante con ese sku, o con esa combinación de talla y color." });
    }
    res.status(500).json({ message: "Error al actualizar la variante.", error: error.message });
  }
};

// Eliminar una variante que nunca se vendió
exports.delete = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id de la variante debe ser un entero positivo." });
    }

    const variante = await Variante.findByPk(id);
    if (!variante) {
      return res.status(404).json({ message: `No se encontró una variante con id ${id}.` });
    }

    // Todo producto debe conservar al menos una variante
    const total = await Variante.count({ where: { id_producto: variante.id_producto } });
    if (total <= 1) {
      return res.status(409).json({
        message: "No se puede eliminar la última variante de un producto. Desactívala con activo: false."
      });
    }

    await variante.destroy();

    res.status(200).json({ message: "Variante eliminada correctamente." });
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({
        message: "No se puede eliminar la variante porque tiene ventas o movimientos de inventario. Desactívala con activo: false."
      });
    }
    res.status(500).json({ message: "Error al eliminar la variante.", error: error.message });
  }
};

// Ajuste manual de stock: entrada o salida con motivo (la lógica está en inventario.service.js)
exports.ajustarStock = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);
    if (id === null) {
      return res.status(400).json({ message: "El id de la variante debe ser un entero positivo." });
    }

    const body = req.body || {};

    const tipoMovimiento = body.tipo_movimiento;
    if (tipoMovimiento !== "entrada" && tipoMovimiento !== "salida") {
      return res.status(400).json({ message: 'tipo_movimiento debe ser "entrada" o "salida".' });
    }

    // Solo se acepta un número JSON (no texto ni booleanos)
    const cantidad = typeof body.cantidad === "number" ? parsePositiveInt(body.cantidad, null) : null;
    if (cantidad === null) {
      return res.status(400).json({ message: "cantidad debe ser un entero mayor que 0." });
    }

    const motivo = cleanText(body.motivo);
    if (!motivo) {
      return res.status(400).json({ message: "El motivo es obligatorio." });
    }
    if (motivo.length > 150) {
      return res.status(400).json({ message: "El motivo no puede pasar de 150 caracteres." });
    }

    const { variante, movimiento } = await ajustarStock({
      idVariante: id,
      tipoMovimiento,
      cantidad,
      motivo
    });

    res.status(200).json({ message: "Stock ajustado correctamente.", variante, movimiento });
  } catch (error) {
    if (error instanceof ErrorInventario) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: "Error al ajustar el stock.", error: error.message });
  }
};