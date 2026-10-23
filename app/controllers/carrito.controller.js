const db = require("../models");
const { validarYCalcular, round2 } = require("../services/cupon.service.js");
const { IMPUESTO_RATE, ENVIO_GRATIS_DESDE, calcularTotales } = require("../services/totales.service.js");

const Carrito = db.carritos;
const DetalleCarrito = db.detalleCarrito;
const Variante = db.variantes;
const Producto = db.productos;
const sequelize = db.sequelize;

const MAX_CANTIDAD_LINEA = 99; // unidades máximas por variante
const MAX_LINEAS = 50; // variantes distintas por carrito

// "Camiseta running (M, Negro)"
const describirVariante = (producto, variante) => {
  const extra = [variante.talla, variante.color].filter(Boolean).join(", ");
  return extra ? `${producto.nombre} (${extra})` : producto.nombre;
};

// Estado de cada línea según el stock y la actividad actuales (nunca se oculta una línea)
const estadoLinea = (variante, producto, cantidad) => {
  if (!variante || !variante.activo || !producto || !producto.activo) return "no_disponible";
  if (variante.stock <= 0) return "agotado";
  if (variante.stock < cantidad) return "stock_insuficiente";
  return "disponible";
};

// El carrito es solo de clientes y el cliente sale del token (no se acepta id_cliente por parámetro)
const clienteDelToken = async (req) => {
  if (req.usuario.tipo !== "cliente") {
    throw { status: 403, message: "Solo un cliente tiene carrito." };
  }
  const idUsuario = req.usuario.id ?? req.usuario.id_usuario;
  const cliente = await db.clientes.findOne({ where: { id_usuario: idUsuario } });
  if (!cliente) {
    throw { status: 404, message: "No se encontró el cliente del usuario autenticado." };
  }
  return cliente;
};

const enTransaccion = async (fn) => {
  const t = await sequelize.transaction();
  try {
    const resultado = await fn(t);
    await t.commit();
    return resultado;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// Crea el carrito del cliente la primera vez que lo usa (apoyado en el UNIQUE de id_cliente)
const obtenerCarrito = async (idCliente, transaction) => {
  const [carrito] = await Carrito.findOrCreate({ where: { id_cliente: idCliente }, transaction });
  return carrito;
};

const cargarVarianteActiva = async (idVariante, transaction) => {
  const variante = await Variante.findByPk(idVariante, { transaction });
  if (!variante || !variante.activo) {
    throw { status: 404, message: `La variante ${idVariante} no existe o no está activa.` };
  }
  const producto = await Producto.findByPk(variante.id_producto, { transaction });
  if (!producto || !producto.activo) {
    throw { status: 404, message: `El producto de la variante ${idVariante} no existe o no está activo.` };
  }
  return { variante, producto };
};

// Valida la cantidad total que quedaría en el carrito (el stock real se vuelve a validar al crear el pedido)
const validarCantidad = (variante, producto, cantidadTotal) => {
  if (cantidadTotal > MAX_CANTIDAD_LINEA) {
    throw { status: 400, message: `Máximo ${MAX_CANTIDAD_LINEA} unidades por producto en el carrito.` };
  }
  if (variante.stock < cantidadTotal) {
    throw {
      status: 400,
      message: `Stock insuficiente para "${describirVariante(producto, variante)}". Disponible: ${variante.stock}, solicitado: ${cantidadTotal}.`,
    };
  }
};

// Arma la respuesta del carrito con precios y stock vigentes.
// Cupón opcional (?cupon=CODIGO): solo vista previa, no consume usos ni se guarda.
const vistaCarrito = async (carrito, codigoCupon) => {
  const filas = await DetalleCarrito.findAll({
    where: { id_carrito: carrito.id_carrito },
    include: [{ model: Variante, as: "variante", include: [{ model: Producto, as: "producto" }] }],
    order: [
      ["fecha_agregado", "ASC"],
      ["id_detalle_carrito", "ASC"],
    ],
  });

  let subtotal = 0;
  let unidades = 0;
  let conProblema = 0;

  const items = filas.map((f) => {
    const v = f.variante;
    const p = v ? v.producto : null;
    const estado = estadoLinea(v, p, f.cantidad);
    const precio = p ? Number(p.precio_venta) : Number(f.precio_al_agregar);
    const subtotalLinea = round2(precio * f.cantidad);

    unidades += f.cantidad;
    if (estado === "disponible") subtotal += subtotalLinea;
    else conProblema += 1;

    const item = {
      id_variante: f.id_variante,
      sku: v ? v.sku : null,
      talla: v ? v.talla : null,
      color: v ? v.color : null,
      imagen_url: v ? v.imagen_url ?? null : null,
      producto: p ? { id: p.id, nombre: p.nombre } : null,
      cantidad: f.cantidad,
      precio_unitario: precio,
      subtotal: subtotalLinea,
      estado,
    };

    // Solo se informa el stock cuando hay menos de lo pedido, para que el cliente ajuste la cantidad
    if (estado === "stock_insuficiente") item.stock_disponible = v.stock;
    // Aviso de cambio de precio desde que lo agregó
    if (p && Number(f.precio_al_agregar) !== precio) item.precio_anterior = Number(f.precio_al_agregar);

    return item;
  });

  subtotal = round2(subtotal);

  let descuento = 0;
  let cupon = null;
  if (codigoCupon && subtotal > 0) {
    try {
      const r = await validarYCalcular(db, codigoCupon, subtotal, undefined, IMPUESTO_RATE);
      descuento = r.descuento;
      cupon = { codigo: r.cupon.codigo, valido: true, descuento };
    } catch (err) {
      // Un cupón inválido no rompe el carrito: se informa y se muestran los totales sin descuento
      if (!err.status || err.status >= 500) throw err;
      cupon = { codigo: codigoCupon, valido: false, mensaje: err.message };
    }
  }

  // Sin líneas comprables no hay nada que cobrar (ni envío)
  const { impuestos, costoEnvio, total } =
    subtotal > 0
      ? calcularTotales({ subtotal, descuento })
      : { impuestos: 0, costoEnvio: 0, total: 0 };
      
  return {
    id_carrito: carrito.id_carrito,
    items,
    cupon,
    resumen: {
      unidades,
      lineas: items.length,
      lineas_con_problema: conProblema,
      subtotal,
      descuento,
      impuestos,
      costo_envio: costoEnvio,
      envio_gratis_desde: ENVIO_GRATIS_DESDE || null,
      total,
    },
  };
};

const responderError = (res, err, mensaje) =>
  res.status(err.status || 500).json({ message: err.message || mensaje });

// GET /api/carrito?cupon=CODIGO
exports.getCarrito = async (req, res) => {
  try {
    const cliente = await clienteDelToken(req);
    const carrito = await obtenerCarrito(cliente.id);
    return res.status(200).json(await vistaCarrito(carrito, req.query.cupon));
  } catch (err) {
    return responderError(res, err, "Error al obtener el carrito.");
  }
};

// POST /api/carrito/items  { id_variante, cantidad }  -> agrega o suma
exports.agregarItem = async (req, res) => {
  const { id_variante, cantidad } = req.body;
  if (!Number.isInteger(id_variante) || !Number.isInteger(cantidad) || cantidad <= 0) {
    return res.status(400).json({ message: "id_variante y una cantidad entera > 0 son obligatorios." });
  }

  try {
    const cliente = await clienteDelToken(req);

    const carrito = await enTransaccion(async (t) => {
      const c = await obtenerCarrito(cliente.id, t);
      // Se bloquea el carrito para serializar cambios simultáneos sobre el mismo carrito
      await Carrito.findByPk(c.id_carrito, { transaction: t, lock: t.LOCK.UPDATE });

      const { variante, producto } = await cargarVarianteActiva(id_variante, t);
      const existente = await DetalleCarrito.findOne({
        where: { id_carrito: c.id_carrito, id_variante },
        transaction: t,
      });

      const cantidadTotal = (existente ? existente.cantidad : 0) + cantidad;
      validarCantidad(variante, producto, cantidadTotal);

      if (existente) {
        existente.cantidad = cantidadTotal;
        existente.precio_al_agregar = producto.precio_venta;
        await existente.save({ transaction: t });
      } else {
        const lineas = await DetalleCarrito.count({ where: { id_carrito: c.id_carrito }, transaction: t });
        if (lineas >= MAX_LINEAS) {
          throw { status: 400, message: `El carrito admite hasta ${MAX_LINEAS} productos distintos.` };
        }
        await DetalleCarrito.create(
          {
            id_carrito: c.id_carrito,
            id_variante,
            cantidad: cantidadTotal,
            precio_al_agregar: producto.precio_venta,
          },
          { transaction: t }
        );
      }

      await c.update({ fecha_actualizacion: new Date() }, { transaction: t });
      return c;
    });

    return res.status(200).json(await vistaCarrito(carrito, req.query.cupon));
  } catch (err) {
    return responderError(res, err, "Error al agregar al carrito.");
  }
};

// PUT /api/carrito/items/:id_variante  { cantidad }  -> fija la cantidad
exports.actualizarItem = async (req, res) => {
  const idVariante = parseInt(req.params.id_variante, 10);
  const { cantidad } = req.body;
  if (!Number.isInteger(idVariante) || !Number.isInteger(cantidad) || cantidad <= 0) {
    return res.status(400).json({ message: "Se requiere una cantidad entera > 0 (para quitar el producto use DELETE)." });
  }

  try {
    const cliente = await clienteDelToken(req);

    const carrito = await enTransaccion(async (t) => {
      const c = await obtenerCarrito(cliente.id, t);
      await Carrito.findByPk(c.id_carrito, { transaction: t, lock: t.LOCK.UPDATE });

      const existente = await DetalleCarrito.findOne({
        where: { id_carrito: c.id_carrito, id_variante: idVariante },
        transaction: t,
      });
      if (!existente) {
        throw { status: 404, message: "Esa variante no está en tu carrito." };
      }

      const { variante, producto } = await cargarVarianteActiva(idVariante, t);
      validarCantidad(variante, producto, cantidad);

      existente.cantidad = cantidad;
      existente.precio_al_agregar = producto.precio_venta;
      await existente.save({ transaction: t });
      await c.update({ fecha_actualizacion: new Date() }, { transaction: t });
      return c;
    });

    return res.status(200).json(await vistaCarrito(carrito, req.query.cupon));
  } catch (err) {
    return responderError(res, err, "Error al actualizar el carrito.");
  }
};

// DELETE /api/carrito/items/:id_variante
exports.quitarItem = async (req, res) => {
  const idVariante = parseInt(req.params.id_variante, 10);
  if (!Number.isInteger(idVariante)) {
    return res.status(400).json({ message: "id_variante inválido." });
  }

  try {
    const cliente = await clienteDelToken(req);

    const carrito = await enTransaccion(async (t) => {
      const c = await obtenerCarrito(cliente.id, t);
      await Carrito.findByPk(c.id_carrito, { transaction: t, lock: t.LOCK.UPDATE });

      const borradas = await DetalleCarrito.destroy({
        where: { id_carrito: c.id_carrito, id_variante: idVariante },
        transaction: t,
      });
      if (borradas === 0) {
        throw { status: 404, message: "Esa variante no está en tu carrito." };
      }

      await c.update({ fecha_actualizacion: new Date() }, { transaction: t });
      return c;
    });

    return res.status(200).json(await vistaCarrito(carrito, req.query.cupon));
  } catch (err) {
    return responderError(res, err, "Error al quitar el producto del carrito.");
  }
};

// DELETE /api/carrito  -> vacía el carrito
exports.vaciarCarrito = async (req, res) => {
  try {
    const cliente = await clienteDelToken(req);

    const carrito = await enTransaccion(async (t) => {
      const c = await obtenerCarrito(cliente.id, t);
      await Carrito.findByPk(c.id_carrito, { transaction: t, lock: t.LOCK.UPDATE });
      await DetalleCarrito.destroy({ where: { id_carrito: c.id_carrito }, transaction: t });
      await c.update({ fecha_actualizacion: new Date() }, { transaction: t });
      return c;
    });

    return res.status(200).json(await vistaCarrito(carrito));
  } catch (err) {
    return responderError(res, err, "Error al vaciar el carrito.");
  }
};