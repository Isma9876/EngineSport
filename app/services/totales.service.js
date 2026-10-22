const { round2 } = require("./cupon.service.js");

// Única fuente de la fórmula de totales: la usan crearPedido y la vista del carrito,
// para que el total mostrado en el carrito sea el mismo que se cobra al crear el pedido.
const IMPUESTO_RATE = 0.12; // IVA Guatemala 12% — ajustar si el equipo decide otro valor
const ENVIO_COSTO = Number(process.env.ENVIO_COSTO) || 0;
const ENVIO_GRATIS_DESDE = Number(process.env.ENVIO_GRATIS_DESDE) || 0; // 0 = sin envío gratis

// subtotal: suma de las líneas (sin IVA). descuento: monto ya calculado por el cupón (0 si no hay).
// IVA sobre (subtotal - descuento); envío fijo sin IVA, gratis si esa base alcanza el umbral.
const calcularTotales = ({ subtotal, descuento = 0 }) => {
  const base = round2(subtotal - descuento);
  const impuestos = round2(base * IMPUESTO_RATE);
  const costoEnvio = ENVIO_GRATIS_DESDE > 0 && base >= ENVIO_GRATIS_DESDE ? 0 : ENVIO_COSTO;
  const total = round2(base + impuestos + costoEnvio);
  return { base, impuestos, costoEnvio, total };
};

module.exports = { IMPUESTO_RATE, ENVIO_COSTO, ENVIO_GRATIS_DESDE, calcularTotales };