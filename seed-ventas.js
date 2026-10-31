// seed-ventas.js
// Carga datos de prueba del módulo de Ventas: 4 clientes de prueba con su dirección,
// 4 cupones, 11 pedidos en los cuatro estados (con detalle, pagos y movimientos de inventario).
// Idempotente: usuarios por email, cupones por código; si los clientes de prueba ya tienen
// pedidos, los pedidos se omiten. Nunca borra ni modifica lo existente.
// Todo corre en una sola transacción: si algo falla, se revierte todo.
// Requiere que el catálogo (seed de Isma) ya esté cargado: busca variantes por sku (P01-..., P08-...).
// Ejecutar desde la raíz del proyecto con: node seed-ventas.js
// Antes de tocar nada, muestra a qué servidor de base de datos se conectará y pide confirmación.
// Si el host es el de production (ep-sweet-wave...), se niega a correr salvo que se defina
// PERMITIR_PRODUCCION=si en esa sesión.

require("dotenv").config({ path: `.env.${process.env.NODE_ENV || "development"}` });
const crypto = require("node:crypto");
const readline = require("node:readline/promises");
const bcrypt = require("bcryptjs");
const db = require("./app/models");
const { round2 } = require("./app/services/cupon.service.js");
const { calcularTotales } = require("./app/services/totales.service.js");

const CLIENTES = [
  { email: "marta.perez@example.com", nombre: "Marta", apellido: "Pérez", telefono: "50255550001", direccion: "6a avenida 12-30 zona 1", ciudad: "Guatemala", estado: "Guatemala", cp: "01001" },
  { email: "luis.gomez@example.com", nombre: "Luis", apellido: "Gómez", telefono: "50255550002", direccion: "3a calle 4-15 zona 3", ciudad: "Quetzaltenango", estado: "Quetzaltenango", cp: "09001" },
  { email: "ana.lopez@example.com", nombre: "Ana", apellido: "López", telefono: "50255550003", direccion: "Km 22 Carretera a El Salvador", ciudad: "Santa Catarina Pinula", estado: "Guatemala", cp: "01051" },
  { email: "carlos.ramirez@example.com", nombre: "Carlos", apellido: "Ramírez", telefono: "50255550004", direccion: "2a avenida 8-45 zona 4", ciudad: "Cobán", estado: "Alta Verapaz", cp: "16001" }
];

const CUPONES = [
  { codigo: "SEED10", descripcion: "10 % de descuento", tipo: "porcentaje", valor: 10, usos_maximos: 100, monto_minimo: 0 },
  { codigo: "SEED50Q", descripcion: "Q50 de descuento desde Q300", tipo: "monto", valor: 50, usos_maximos: 50, monto_minimo: 300 },
  { codigo: "SEEDAGOTADO", descripcion: "Cupón de un solo uso", tipo: "porcentaje", valor: 15, usos_maximos: 1, monto_minimo: 0 },
  { codigo: "SEEDVENCIDO", descripcion: "Cupón vencido", tipo: "porcentaje", valor: 20, usos_maximos: 100, monto_minimo: 0, vigencia_fin: new Date("2026-09-01T23:59:59-06:00") }
];

// items: [numero de producto del seed de Isma (P01 = 1), cantidad]
// cliente: índice en CLIENTES. El pedido pendiente (9) no lleva pago, como en el flujo real.
const PEDIDOS = [
  { cliente: 0, fecha: "2026-08-14T15:30:00-06:00", estado: "enviado", items: [[1, 1], [8, 2]], cupon: "SEEDAGOTADO", transportista: "Cargo Expreso", guia: "SEED-CE-0001" },
  { cliente: 1, fecha: "2026-08-27T10:10:00-06:00", estado: "enviado", items: [[13, 1], [16, 2]], cupon: "SEED10", transportista: "Guatex", guia: "SEED-GX-0002" },
  { cliente: 2, fecha: "2026-09-09T18:45:00-06:00", estado: "enviado", items: [[3, 1]], transportista: "Cargo Expreso", guia: "SEED-CE-0003" },
  { cliente: 3, fecha: "2026-09-21T09:20:00-06:00", estado: "pagado", items: [[5, 1], [11, 2]], cupon: "SEED50Q" },
  { cliente: 0, fecha: "2026-10-04T12:05:00-06:00", estado: "pagado", items: [[23, 2], [19, 1]], cupon: "SEED10" },
  { cliente: 1, fecha: "2026-10-12T16:40:00-06:00", estado: "pagado", items: [[14, 1]] },
  { cliente: 2, fecha: "2026-10-18T11:15:00-06:00", estado: "enviado", items: [[2, 1], [16, 1]], transportista: "Guatex", guia: "SEED-GX-0007" },
  { cliente: 3, fecha: "2026-10-24T14:00:00-06:00", estado: "pagado", items: [[20, 1], [22, 2]] },
  { cliente: 0, fecha: null, estado: "pendiente", items: [[8, 1]] }, // fecha = ahora
  { cliente: 1, fecha: "2026-10-20T08:30:00-06:00", estado: "cancelado", items: [[24, 1]] }, // reserva expirada, sin pago
  { cliente: 3, fecha: "2026-10-26T19:10:00-06:00", estado: "cancelado", items: [[10, 1]], pago: "fallido" } // pago fallido y cancelado
];

async function confirmarBase() {
  console.log(`\nBase de datos destino: ${process.env.DB_HOST}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await rl.question("¿Continuar con el seed en esa base? (escribe si): ");
  rl.close();
  return respuesta.trim().toLowerCase() === "si";
}

const descuentoDe = (cupon, subtotal) => {
  if (!cupon) return 0;
  if (subtotal < Number(cupon.monto_minimo)) {
    throw new Error(`El subtotal ${subtotal} no alcanza el monto mínimo del cupón ${cupon.codigo}.`);
  }
  return cupon.tipo === "porcentaje"
    ? round2((subtotal * Number(cupon.valor)) / 100)
    : Math.min(Number(cupon.valor), subtotal);
};

async function sembrar(t) {
  // 1. Clientes de prueba (usuario + cliente + dirección). Contraseña aleatoria: no pueden iniciar sesión.
  const clientes = [];
  for (const c of CLIENTES) {
    const email = c.email;
    let usuario = await db.usuarios.findOne({ where: { email }, transaction: t });
    if (!usuario) {
      const password = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
      usuario = await db.usuarios.create({ email, password, tipo: "cliente" }, { transaction: t });
    }
    let cliente = await db.clientes.findOne({ where: { id_usuario: usuario.id }, transaction: t });
    if (!cliente) {
      cliente = await db.clientes.create(
        { id_usuario: usuario.id, nombre: c.nombre, apellido: c.apellido, telefono: c.telefono },
        { transaction: t }
      );
    }
    let direccion = await db.direccionesCliente.findOne({ where: { id_cliente: cliente.id }, transaction: t });
    if (!direccion) {
      direccion = await db.direccionesCliente.create(
        { id_cliente: cliente.id, direccion: c.direccion, ciudad: c.ciudad, estado: c.estado, codigo_postal: c.cp, pais: "Guatemala", es_predeterminada: true },
        { transaction: t }
      );
    }
    clientes.push({ cliente, direccion });
  }

  // 2. Cupones (por código)
  const cupones = {};
  for (const c of CUPONES) {
    const [cupon] = await db.cupon.findOrCreate({ where: { codigo: c.codigo }, defaults: c, transaction: t });
    cupones[c.codigo] = cupon;
  }

  // 3. Si los clientes de prueba ya tienen pedidos, no se repiten
  const yaHay = await db.pedidos.count({
    where: { id_cliente: clientes.map((x) => x.cliente.id) },
    transaction: t
  });
  if (yaHay > 0) {
    console.log(`Los clientes de prueba ya tienen ${yaHay} pedidos: se omiten los pedidos.`);
    return;
  }

  const empleado = await db.empleados.findOne({ order: [["id", "ASC"]], transaction: t });
  if (!empleado) throw new Error("No hay ningún empleado para asignar a los pedidos enviados.");

  // 4. Variantes del catálogo (se elige la primera de cada producto con stock suficiente)
  const variantes = await db.variantes.findAll({
    where: { activo: true },
    include: [{ model: db.productos, as: "producto" }],
    order: [["id", "ASC"]],
    transaction: t
  });
  const variantePorProducto = (numero) => {
    const prefijo = `P${String(numero).padStart(2, "0")}-`;
    const v = variantes.find((x) => x.sku.startsWith(prefijo) && x.stock >= 5);
    if (!v) throw new Error(`No se encontró una variante con sku ${prefijo}... y stock suficiente. ¿Está cargado el catálogo?`);
    return v;
  };

  // 5. Pedidos
  let numeroPago = 0;
  for (const spec of PEDIDOS) {
    const { cliente, direccion } = clientes[spec.cliente];
    const fecha = spec.fecha ? new Date(spec.fecha) : new Date();

    const lineas = spec.items.map(([numero, cantidad]) => {
      const variante = variantePorProducto(numero);
      if (variante.stock < cantidad) throw new Error(`Stock insuficiente en ${variante.sku}.`);
      const precio = Number(variante.producto.precio_venta);
      return { variante, cantidad, precio, subtotal: round2(precio * cantidad) };
    });

    const subtotal = round2(lineas.reduce((suma, l) => suma + l.subtotal, 0));
    const cupon = spec.cupon ? cupones[spec.cupon] : null;
    const descuento = descuentoDe(cupon, subtotal);
    const { impuestos, costoEnvio, total } = calcularTotales({ subtotal, descuento });
    const enviado = spec.estado === "enviado";

    const pedido = await db.pedidos.create(
      {
        id_cliente: cliente.id,
        id_empleado: enviado ? empleado.id : null,
        id_direccion_envio: direccion.id,
        fecha_pedido: fecha,
        estado: spec.estado,
        subtotal,
        impuestos,
        total,
        id_cupon: cupon ? cupon.id_cupon : null,
        descuento,
        costo_envio: costoEnvio,
        transportista: enviado ? spec.transportista : null,
        numero_guia: enviado ? spec.guia : null,
        fecha_envio: enviado ? new Date(fecha.getTime() + 24 * 60 * 60 * 1000) : null
      },
      { transaction: t }
    );

    await db.detallePedidos.bulkCreate(
      lineas.map((l) => ({
        id_pedido: pedido.id_pedido,
        id_variante: l.variante.id,
        cantidad: l.cantidad,
        precio_unitario: l.precio,
        subtotal: l.subtotal
      })),
      { transaction: t }
    );

    // Reserva: toda venta descuenta stock con su movimiento de salida.
    // Si el pedido quedó cancelado, la reserva se libera: entrada de ajuste y stock sin cambio neto.
    for (const l of lineas) {
      await db.movimientosInventario.create(
        { id_variante: l.variante.id, tipo_movimiento: "salida", cantidad: l.cantidad, fecha, motivo: `venta: pedido #${pedido.id_pedido}`, id_pedido: pedido.id_pedido },
        { transaction: t }
      );
      if (spec.estado === "cancelado") {
        await db.movimientosInventario.create(
          { id_variante: l.variante.id, tipo_movimiento: "entrada", cantidad: l.cantidad, fecha: new Date(fecha.getTime() + 30 * 60 * 1000), motivo: `ajuste: pedido #${pedido.id_pedido} cancelado, reserva liberada`, id_pedido: pedido.id_pedido },
          { transaction: t }
        );
      } else {
        await l.variante.update({ stock: l.variante.stock - l.cantidad }, { transaction: t });
      }
    }

    if (cupon && spec.estado !== "cancelado") {
      await cupon.increment("usos_actuales", { transaction: t });
    }

    // Pago: completado si el pedido se pagó; fallido si el pedido se canceló tras un intento; sin pago si está pendiente
    const estadoPago = spec.estado === "pagado" || enviado ? "completado" : spec.pago || null;
    if (estadoPago) {
      numeroPago += 1;
      await db.pagos.create(
        {
          id_pedido: pedido.id_pedido,
          metodo_pago: "stripe",
          monto: total,
          fecha_pago: estadoPago === "completado" ? new Date(fecha.getTime() + 5 * 60 * 1000) : null,
          estado_pago: estadoPago,
          referencia_transaccion: `pi_seed_${String(numeroPago).padStart(2, "0")}`
        },
        { transaction: t }
      );
    }
  }

  const resumen = await db.pedidos.findAll({
    attributes: ["estado", [db.Sequelize.fn("count", "*"), "n"]],
    where: { id_cliente: clientes.map((x) => x.cliente.id) },
    group: ["estado"],
    raw: true,
    transaction: t
  });
  console.log("Pedidos creados por estado:", resumen.map((r) => `${r.estado}: ${r.n}`).join(", "));
}

async function main() {
  const host = process.env.DB_HOST || "";
  if (host.startsWith("ep-sweet-wave") && process.env.PERMITIR_PRODUCCION !== "si") {
    console.error(`El host ${host} es el de production. Ensaya primero en una rama de prueba de Neon.`);
    process.exit(1);
  }
  if (!(await confirmarBase())) {
    console.log("Cancelado. No se tocó nada.");
    await db.sequelize.close();
    return;
  }
  await db.sequelize.transaction(sembrar);
  console.log("Seed de ventas terminado.");
  await db.sequelize.close();
}

main().catch(async (error) => {
  console.error("Error, se revirtió todo:", error.message);
  try {
    await db.sequelize.close();
  } catch (e) {
    // sin conexión que cerrar
  }
  process.exit(1);
});