// seed.js
// Script de un solo uso (pero seguro de correr varias veces) para poblar
// categorías, proveedores y productos de prueba con datos realistas.
// Ejecutar desde la raíz del proyecto con: node seed.js
// Usa findOrCreate, así que si lo corres dos veces no duplica nada.

require("dotenv").config({ path: `.env.${process.env.NODE_ENV || "development"}` });
const db = require("./app/models");

async function seed() {
  try {
    // ===== Categorías raíz =====
    const [calzado] = await db.categorias.findOrCreate({
      where: { nombre: "Calzado" },
      defaults: { descripcion: "Zapatos y tenis deportivos", id_categoria_padre: null }
    });

    const [ropa] = await db.categorias.findOrCreate({
      where: { nombre: "Ropa" },
      defaults: { descripcion: "Prendas de vestir deportivas", id_categoria_padre: null }
    });

    const [accesorios] = await db.categorias.findOrCreate({
      where: { nombre: "Accesorios" },
      defaults: { descripcion: "Guantes, gorras, bolsos deportivos y otros accesorios", id_categoria_padre: null }
    });

    // Nota: si "Accesorios" ya existía de una prueba anterior con un padre
    // asignado por error, la regresamos a categoría raíz aquí.
    if (accesorios.id_categoria_padre !== null) {
      await accesorios.update({ id_categoria_padre: null });
    }

    const [equipamiento] = await db.categorias.findOrCreate({
      where: { nombre: "Equipamiento" },
      defaults: { descripcion: "Equipo para entrenamiento y gimnasio", id_categoria_padre: null }
    });

    // ===== Subcategorías =====
    const [tenisRunning] = await db.categorias.findOrCreate({
      where: { nombre: "Tenis para correr" },
      defaults: { descripcion: "Calzado especializado para running", id_categoria_padre: calzado.id }
    });

    const [tenisCasual] = await db.categorias.findOrCreate({
      where: { nombre: "Tenis casuales" },
      defaults: { descripcion: "Calzado deportivo de uso diario", id_categoria_padre: calzado.id }
    });

    const [playeras] = await db.categorias.findOrCreate({
      where: { nombre: "Playeras" },
      defaults: { descripcion: "Playeras deportivas y de compresión", id_categoria_padre: ropa.id }
    });

    const [shorts] = await db.categorias.findOrCreate({
      where: { nombre: "Shorts" },
      defaults: { descripcion: "Shorts para entrenamiento y running", id_categoria_padre: ropa.id }
    });

    console.log("Categorías listas.");

    // ===== Proveedores =====
    const [provGT] = await db.proveedores.findOrCreate({
      where: { nombre_empresa: "Distribuidora Deportiva GT" },
      defaults: {
        contacto: "Carlos Méndez",
        telefono: "5555-1234",
        email: "ventas@distribuidoragt.com",
        direccion: "Zona 4, Ciudad de Guatemala"
      }
    });

    const [provTex] = await db.proveedores.findOrCreate({
      where: { nombre_empresa: "TexDeportes S.A." },
      defaults: {
        contacto: "Ana Rodríguez",
        telefono: "5555-5678",
        email: "contacto@texdeportes.com",
        direccion: "Zona 10, Ciudad de Guatemala"
      }
    });

    const [provImport] = await db.proveedores.findOrCreate({
      where: { nombre_empresa: "Import Sport Guatemala" },
      defaults: {
        contacto: "Luis Herrera",
        telefono: "5555-9012",
        email: "ventas@importsportgt.com",
        direccion: "Mixco, Guatemala"
      }
    });

    const [provFitness] = await db.proveedores.findOrCreate({
      where: { nombre_empresa: "Fitness Warehouse GT" },
      defaults: {
        contacto: "María Solís",
        telefono: "5555-3456",
        email: "info@fitnesswarehousegt.com",
        direccion: "Zona 12, Ciudad de Guatemala"
      }
    });

    console.log("Proveedores listos.");

    // ===== Productos =====
    const productos = [
      { sku: "TEN-RUN-001", nombre: "Tenis Running Pro", descripcion: "Tenis para correr, amortiguación media", precio_costo: 250, precio_venta: 429.99, stock: 43, stock_minimo: 10, id_categoria: tenisRunning.id, id_proveedor: provGT.id },
      { sku: "TEN-RUN-002", nombre: "Tenis Running Ultraboost", descripcion: "Amortiguación alta, ideal para largas distancias", precio_costo: 380, precio_venta: 649.99, stock: 20, stock_minimo: 5, id_categoria: tenisRunning.id, id_proveedor: provImport.id },
      { sku: "TEN-CAS-001", nombre: "Tenis Casual Urban", descripcion: "Uso diario, estilo urbano", precio_costo: 180, precio_venta: 329.99, stock: 35, stock_minimo: 8, id_categoria: tenisCasual.id, id_proveedor: provGT.id },
      { sku: "TEN-CAS-002", nombre: "Tenis Casual Classic", descripcion: "Diseño clásico, suela de goma", precio_costo: 150, precio_venta: 279.99, stock: 28, stock_minimo: 8, id_categoria: tenisCasual.id, id_proveedor: provTex.id },
      { sku: "PLA-001", nombre: "Playera Dry-Fit Manga Corta", descripcion: "Tela transpirable, corte atlético", precio_costo: 45, precio_venta: 99.99, stock: 60, stock_minimo: 15, id_categoria: playeras.id, id_proveedor: provTex.id },
      { sku: "PLA-002", nombre: "Playera de Compresión", descripcion: "Ajuste ceñido, ideal para entrenamiento", precio_costo: 55, precio_venta: 119.99, stock: 40, stock_minimo: 10, id_categoria: playeras.id, id_proveedor: provTex.id },
      { sku: "SHO-001", nombre: "Short Deportivo", descripcion: "Short ligero con bolsillos laterales", precio_costo: 50, precio_venta: 89.99, stock: 30, stock_minimo: 10, id_categoria: shorts.id, id_proveedor: provTex.id },
      { sku: "SHO-002", nombre: "Short de Compresión", descripcion: "Short interior para running", precio_costo: 40, precio_venta: 79.99, stock: 25, stock_minimo: 8, id_categoria: shorts.id, id_proveedor: provImport.id },
      { sku: "ACC-001", nombre: "Gorra Deportiva", descripcion: "Gorra ajustable con visera curva", precio_costo: 30, precio_venta: 59.99, stock: 50, stock_minimo: 12, id_categoria: accesorios.id, id_proveedor: provImport.id },
      { sku: "ACC-002", nombre: "Guantes de Entrenamiento", descripcion: "Guantes acolchados para gimnasio", precio_costo: 35, precio_venta: 69.99, stock: 32, stock_minimo: 10, id_categoria: accesorios.id, id_proveedor: provFitness.id },
      { sku: "ACC-003", nombre: "Bolso Deportivo Mediano", descripcion: "Compartimento para zapatos", precio_costo: 80, precio_venta: 149.99, stock: 18, stock_minimo: 5, id_categoria: accesorios.id, id_proveedor: provImport.id },
      { sku: "ACC-004", nombre: "Medias Deportivas (Par)", descripcion: "Tela acolchada, alta transpirabilidad", precio_costo: 15, precio_venta: 34.99, stock: 80, stock_minimo: 20, id_categoria: accesorios.id, id_proveedor: provTex.id },
      { sku: "EQU-001", nombre: "Mancuernas 5kg (Par)", descripcion: "Recubrimiento de neopreno", precio_costo: 120, precio_venta: 199.99, stock: 15, stock_minimo: 4, id_categoria: equipamiento.id, id_proveedor: provFitness.id },
      { sku: "EQU-002", nombre: "Banda de Resistencia", descripcion: "Nivel de resistencia medio", precio_costo: 25, precio_venta: 49.99, stock: 45, stock_minimo: 15, id_categoria: equipamiento.id, id_proveedor: provFitness.id },
      { sku: "EQU-003", nombre: "Cuerda para Saltar", descripcion: "Cable de acero ajustable", precio_costo: 20, precio_venta: 39.99, stock: 55, stock_minimo: 15, id_categoria: equipamiento.id, id_proveedor: provFitness.id },
      { sku: "EQU-004", nombre: "Tapete de Yoga", descripcion: "6mm de grosor, antideslizante", precio_costo: 60, precio_venta: 119.99, stock: 22, stock_minimo: 6, id_categoria: equipamiento.id, id_proveedor: provFitness.id },
      { sku: "EQU-005", nombre: "Balón Medicinal 4kg", descripcion: "Superficie texturizada antideslizante", precio_costo: 90, precio_venta: 159.99, stock: 12, stock_minimo: 4, id_categoria: equipamiento.id, id_proveedor: provFitness.id },
      { sku: "ACC-005", nombre: "Termo Deportivo 1L", descripcion: "Doble pared, mantiene temperatura", precio_costo: 45, precio_venta: 89.99, stock: 38, stock_minimo: 10, id_categoria: accesorios.id, id_proveedor: provImport.id }
    ];

    for (const p of productos) {
      const [producto, creado] = await db.productos.findOrCreate({
        where: { sku: p.sku },
        defaults: p
      });
      console.log(`${creado ? "Creado" : "Ya existía"}: ${producto.nombre}`);
    }

    console.log("\n Seed completado con éxito.");
  } catch (error) {
    console.error("Error durante el seed:", error.message);
  } finally {
    await db.sequelize.close();
  }
}

seed();
