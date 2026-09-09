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

module.exports = db;