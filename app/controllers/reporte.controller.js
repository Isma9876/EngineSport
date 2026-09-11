// app/controllers/reporte.controller.js
const { Op, fn, col, literal } = require("sequelize");
const db = require("../models");
const Pedido = db.pedidos;
const DetallePedido = db.detallePedidos;
const Producto = db.productos;
const MovimientoInventario = db.movimientosInventario;

// GET /api/reportes/ventas-mensuales?anio=2026
exports.ventasMensuales = async (req, res) => {
  try {
    const anio = req.query.anio || new Date().getFullYear();

    const resultados = await Pedido.findAll({
      attributes: [
        [fn("EXTRACT", literal("MONTH FROM fecha_pedido")), "mes"],
        [fn("COUNT", col("id_pedido")), "cantidad_pedidos"],
        [fn("SUM", col("total")), "total_vendido"],
      ],
      where: {
        estado: { [Op.in]: ["pagado", "enviado"] },
        fecha_pedido: {
          [Op.gte]: new Date(`${anio}-01-01`),
          [Op.lt]: new Date(`${Number(anio) + 1}-01-01`),
        },
      },
      group: [literal("EXTRACT(MONTH FROM fecha_pedido)")],
      order: [[literal("EXTRACT(MONTH FROM fecha_pedido)"), "ASC"]],
      raw: true,
    });

    return res.status(200).json({ anio: Number(anio), ventas_por_mes: resultados });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al generar el reporte de ventas mensuales." });
  }
};

// GET /api/reportes/estado-existencias
exports.estadoExistencias = async (req, res) => {
  try {
    const productos = await Producto.findAll({
      attributes: ["id_producto", "sku", "nombre", "stock", "stock_minimo"],
      where: { activo: true },
      order: [["stock", "ASC"]],
    });

    const bajoMinimo = productos.filter((p) => p.stock <= p.stock_minimo);

    return res.status(200).json({
      total_productos: productos.length,
      productos_bajo_stock_minimo: bajoMinimo.length,
      detalle_bajo_minimo: bajoMinimo,
      inventario_completo: productos,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al generar el reporte de existencias." });
  }
};

exports.productosMasVendidos = async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 10;

    const resultados = await DetallePedido.findAll({
      attributes: [
        [col("detalle_pedidos.id_producto"), "id_producto"],
        [fn("SUM", col("detalle_pedidos.cantidad")), "unidades_vendidas"],
        [fn("SUM", col("detalle_pedidos.subtotal")), "total_generado"],
      ],
      include: [{ model: Producto, as: "producto", attributes: ["nombre", "sku"] }],
      group: ["detalle_pedidos.id_producto", "producto.id_producto", "producto.nombre", "producto.sku"],
      order: [[literal('"unidades_vendidas"'), "DESC"]],
      limit: limite,
      subQuery: false,
    });

    return res.status(200).json(resultados);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al generar el reporte de productos más vendidos." });
  }
};

// GET /api/reportes/movimientos-inventario?id_producto=5
exports.movimientosInventario = async (req, res) => {
  try {
    const { id_producto } = req.query;
    const where = id_producto ? { id_producto } : {};

    const movimientos = await MovimientoInventario.findAll({
      where,
      include: [{ model: Producto, attributes: ["nombre", "sku"] }],
      order: [["fecha", "DESC"]],
    });

    return res.status(200).json(movimientos);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener el historial de movimientos." });
  }
};