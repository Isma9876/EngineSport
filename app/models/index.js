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

// ===== Usuarios / Clientes / Empleados (Alexis) =====

db.usuarios = require("./usuario.model.js")(sequelize, Sequelize);
db.usuarios.rawAttributes.id.field = "id_usuario";

db.clientes = require("./cliente.model.js")(sequelize, Sequelize);
db.clientes.rawAttributes.id.field = "id_cliente";

db.direccionesCliente = require("./direccionCliente.model.js")(sequelize, Sequelize);
db.direccionesCliente.rawAttributes.id.field = "id_direccion";

db.empleados = require("./empleado.model.js")(sequelize, Sequelize);
db.empleados.rawAttributes.id.field = "id_empleado";

// cliente 1-a-1 usuario
db.clientes.belongsTo(db.usuarios, {
  as: "usuario",
  foreignKey: { name: "id_usuario", allowNull: false, unique: true }
});
db.usuarios.hasOne(db.clientes, {
  as: "cliente",
  foreignKey: "id_usuario"
});

// empleado 1-a-1 usuario
db.empleados.belongsTo(db.usuarios, {
  as: "usuario",
  foreignKey: { name: "id_usuario", allowNull: false, unique: true }
});
db.usuarios.hasOne(db.empleados, {
  as: "empleado",
  foreignKey: "id_usuario"
});

// direccion_cliente 1-a-muchos cliente
db.direccionesCliente.belongsTo(db.clientes, {
  as: "cliente",
  foreignKey: { name: "id_cliente", allowNull: false }
});
db.clientes.hasMany(db.direccionesCliente, {
  as: "direcciones",
  foreignKey: "id_cliente"
});

// ===== Catálogo (Isma) =====

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