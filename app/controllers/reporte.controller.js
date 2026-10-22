const { Op, fn, col, literal, QueryTypes } = require("sequelize");
const db = require("../models");
const Pedido = db.pedidos;
const Variante = db.variantes;
const Producto = db.productos;
const MovimientoInventario = db.movimientosInventario;
const sequelize = db.sequelize;

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
// El stock vive en cada variante; el "bajo mínimo" se calcula por variante.
exports.estadoExistencias = async (req, res) => {
  try {
    const variantes = await Variante.findAll({
      attributes: ["id", "sku", "talla", "color", "stock", "stock_minimo"],
      where: { activo: true },
      include: [{ model: Producto, as: "producto", attributes: ["id", "nombre"], where: { activo: true } }],
      order: [["stock", "ASC"]],
    });

    const bajoMinimo = variantes.filter((v) => v.stock <= v.stock_minimo);

    return res.status(200).json({
      total_variantes: variantes.length,
      variantes_bajo_stock_minimo: bajoMinimo.length,
      detalle_bajo_minimo: bajoMinimo,
      inventario_completo: variantes,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al generar el reporte de existencias." });
  }
};

// GET /api/reportes/productos-mas-vendidos?limite=10
// Se agrupa por producto (sumando todas sus variantes) y solo cuenta pedidos
// pagados o enviados: un pedido pendiente o cancelado no es una venta.
exports.productosMasVendidos = async (req, res) => {
  try {
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 10, 1), 100);

    const resultados = await sequelize.query(
      `SELECT p.id_producto,
              p.nombre,
              SUM(d.cantidad)::int AS unidades_vendidas,
              SUM(d.subtotal) AS total_generado
         FROM detalle_pedidos d
         JOIN pedidos pe ON pe.id_pedido = d.id_pedido
         JOIN variantes_producto v ON v.id_variante = d.id_variante
         JOIN productos p ON p.id_producto = v.id_producto
        WHERE pe.estado IN ('pagado', 'enviado')
        GROUP BY p.id_producto, p.nombre
        ORDER BY unidades_vendidas DESC
        LIMIT :limite`,
      { replacements: { limite }, type: QueryTypes.SELECT }
    );

    return res.status(200).json(resultados);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al generar el reporte de productos más vendidos." });
  }
};

// GET /api/reportes/movimientos-inventario?id_variante=5
// También admite ?id_producto=3 para ver los movimientos de todas sus variantes.
exports.movimientosInventario = async (req, res) => {
  try {
    const idVariante = parseInt(req.query.id_variante, 10);
    const idProducto = parseInt(req.query.id_producto, 10);

    const where = Number.isInteger(idVariante) ? { id_variante: idVariante } : {};

    const incluirProducto = { model: Producto, as: "producto", attributes: ["id", "nombre"] };
    if (Number.isInteger(idProducto)) incluirProducto.where = { id: idProducto };

    const movimientos = await MovimientoInventario.findAll({
      where,
      include: [
        {
          model: Variante,
          as: "variante",
          attributes: ["id", "sku", "talla", "color"],
          required: true,
          include: [incluirProducto],
        },
      ],
      order: [["fecha", "DESC"]],
    });

    return res.status(200).json(movimientos);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error al obtener el historial de movimientos." });
  }
};