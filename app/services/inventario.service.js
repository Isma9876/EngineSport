// app/services/inventario.service.js
const db = require("../models");
const MovimientoInventario = db.movimientosInventario;

const MOTIVO_STOCK_INICIAL = "reposición de proveedor";

// Registra una entrada de inventario por el stock con el que nace cada variante.
// Las variantes con stock 0 no generan movimiento (la cantidad mínima es 1).
// Debe llamarse dentro de la misma transacción que crea las variantes, para que
// el stock siempre quede explicado por un movimiento.
const registrarStockInicial = async (variantes, transaction) => {
  const movimientos = variantes
    .filter((variante) => variante.stock > 0)
    .map((variante) => ({
      id_variante: variante.id,
      tipo_movimiento: "entrada",
      cantidad: variante.stock,
      motivo: MOTIVO_STOCK_INICIAL
    }));

  if (movimientos.length === 0) return;

  await MovimientoInventario.bulkCreate(movimientos, { transaction });
};

module.exports = { registrarStockInicial, MOTIVO_STOCK_INICIAL };