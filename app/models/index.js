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

module.exports = db;