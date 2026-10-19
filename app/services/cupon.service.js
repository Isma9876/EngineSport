// app/services/cupon.service.js
// El servidor siempre valida y calcula el descuento; el cliente nunca manda el monto.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Total mínimo (con IVA) que debe quedar a pagar tras aplicar un cupón.
// Configurable con PEDIDO_TOTAL_MINIMO; ajustar al mínimo de cobro de Stripe para GTQ.
const TOTAL_MINIMO = Number(process.env.PEDIDO_TOTAL_MINIMO) || 150;

class CuponError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CuponError";
    this.status = status;
  }
}

/**
 * Valida el cupón y calcula el descuento sobre el subtotal.
 * En crearPedido pasar la transacción: bloquea la fila del cupón para que
 * usos_maximos no se exceda con pedidos simultáneos.
 */
async function validarYCalcular(db, codigo, subtotal, transaction, tasaImpuesto = 0.12) {
  const cupon = await db.cupon.findOne({
    where: { codigo: String(codigo || "").trim().toUpperCase() },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  if (!cupon || !cupon.activo) throw new CuponError("Cupón no válido.");

  const ahora = new Date();
  if (cupon.vigencia_inicio && ahora < cupon.vigencia_inicio)
    throw new CuponError("El cupón aún no está vigente.");
  if (cupon.vigencia_fin && ahora > cupon.vigencia_fin)
    throw new CuponError("El cupón ha vencido.");
  if (cupon.usos_maximos !== null && cupon.usos_actuales >= cupon.usos_maximos)
    throw new CuponError("El cupón alcanzó su límite de usos.");

  const sub = Number(subtotal);
  if (sub < Number(cupon.monto_minimo))
    throw new CuponError(`El monto mínimo para este cupón es ${cupon.monto_minimo}.`);

  const bruto =
    cupon.tipo === "porcentaje" ? (sub * Number(cupon.valor)) / 100 : Number(cupon.valor);
  const descuento = round2(Math.min(bruto, sub)); // nunca mayor que el subtotal

  // El total con IVA es lo que cobra Stripe (no cobra 0 ni montos muy pequeños).
  // Se calcula igual que en crearPedido: impuestos sobre la base ya descontada.
  const base = round2(sub - descuento);
  const totalFinal = round2(base + round2(base * tasaImpuesto));
  if (totalFinal < TOTAL_MINIMO)
    throw new CuponError(
      `El cupón no se puede aplicar: el total del pedido quedaría por debajo del mínimo (${TOTAL_MINIMO.toFixed(2)}).`
    );

  return { cupon, descuento };
}

module.exports = { CuponError, validarYCalcular, round2 };