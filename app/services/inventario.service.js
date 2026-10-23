// app/services/inventario.service.js
const db = require("../models");
const MovimientoInventario = db.movimientosInventario;
const Variante = db.variantes;

const MOTIVO_STOCK_INICIAL = "reposición de proveedor";

// Error con código HTTP, para que el controlador sepa qué responder
class ErrorInventario extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ErrorInventario";
    this.status = status;
  }
}

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

// Ajuste manual de stock: bloquea la variante, cambia su stock y registra el movimiento
// (sin id_pedido), todo en una transacción. Lanza ErrorInventario (404 o 409).
const ajustarStock = async ({ idVariante, tipoMovimiento, cantidad, motivo }) => {
  return db.sequelize.transaction(async (t) => {
    const variante = await Variante.findByPk(idVariante, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!variante) {
      throw new ErrorInventario(404, `No se encontró una variante con id ${idVariante}.`);
    }

    const nuevoStock =
      tipoMovimiento === "entrada" ? variante.stock + cantidad : variante.stock - cantidad;

    if (nuevoStock < 0) {
      throw new ErrorInventario(
        409,
        `No se puede sacar ${cantidad} unidades: el stock actual es ${variante.stock}.`
      );
    }

    await variante.update({ stock: nuevoStock }, { transaction: t });

    const movimiento = await MovimientoInventario.create(
      { id_variante: variante.id, tipo_movimiento: tipoMovimiento, cantidad, motivo },
      { transaction: t }
    );

    return { variante, movimiento };
  });
};

module.exports = { registrarStockInicial, ajustarStock, ErrorInventario, MOTIVO_STOCK_INICIAL };