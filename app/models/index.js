// app/models/index.js
const dbConfig = require("../config/db.config.js");
const Sequelize = require("sequelize");

const sequelizeOptions = {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle
  }
};

if (dbConfig.ssl) {
  sequelizeOptions.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  };
}

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, sequelizeOptions);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.categorias = require("./categoria.model.js")(sequelize, Sequelize);
db.categorias.rawAttributes.id.field = "id_categoria";

db.categorias.belongsTo(db.categorias, {
  as: "categoriaPadre",
  foreignKey: "id_categoria_padre"
});
db.categorias.hasMany(db.categorias, {
  as: "subcategorias",
  foreignKey: "id_categoria_padre"
});

db.proveedores = require("./proveedor.model.js")(sequelize, Sequelize);
db.proveedores.rawAttributes.id.field = "id_proveedor";

db.productos = require("./producto.model.js")(sequelize, Sequelize);
db.productos.rawAttributes.id.field = "id_producto";

db.productos.belongsTo(db.categorias, {
  as: "categoria",
  foreignKey: "id_categoria"
});
db.categorias.hasMany(db.productos, {
  as: "productos",
  foreignKey: "id_categoria"
});

db.productos.belongsTo(db.proveedores, {
  as: "proveedor",
  foreignKey: "id_proveedor"
});
db.proveedores.hasMany(db.productos, {
  as: "productos",
  foreignKey: "id_proveedor"
});

// === Ventas (Persona C) ===
db.pedidos = require("./pedido.model.js")(sequelize, Sequelize);
db.detallePedidos = require("./detallePedido.model.js")(sequelize, Sequelize);
db.pagos = require("./pago.model.js")(sequelize, Sequelize);
db.movimientosInventario = require("./movimientoInventario.model.js")(sequelize, Sequelize);

// pedidos 1-N detalle_pedidos
db.pedidos.hasMany(db.detallePedidos, { foreignKey: "id_pedido", as: "detalles" });
db.detallePedidos.belongsTo(db.pedidos, { foreignKey: "id_pedido" });

// pedidos 1-1 pagos
db.pedidos.hasOne(db.pagos, { foreignKey: "id_pedido" });
db.pagos.belongsTo(db.pedidos, { foreignKey: "id_pedido" });

// pedidos 1-N movimientos_inventario (nullable)
db.pedidos.hasMany(db.movimientosInventario, { foreignKey: "id_pedido" });
db.movimientosInventario.belongsTo(db.pedidos, { foreignKey: "id_pedido" });

// productos 1-N detalle_pedidos
db.productos.hasMany(db.detallePedidos, { foreignKey: "id_producto" });
db.detallePedidos.belongsTo(db.productos, { foreignKey: "id_producto" });

// productos 1-N movimientos_inventario
db.productos.hasMany(db.movimientosInventario, { foreignKey: "id_producto" });
db.movimientosInventario.belongsTo(db.productos, { foreignKey: "id_producto" });

module.exports = db;