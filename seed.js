// seed.js
// Pobla categorías, proveedores y productos de prueba (con sus variantes).
// Seguro de correr varias veces: usa findOrCreate y no duplica nada.
// Ejecutar desde la raíz del proyecto con: node seed.js
// Antes de crear nada, muestra a qué servidor de base de datos se conectará
// y pide confirmación.

require("dotenv").config({ path: `.env.${process.env.NODE_ENV || "development"}` });
const readline = require("node:readline/promises");
const db = require("./app/models");

async function confirmarBase() {
  console.log(`\nBase de datos destino: ${process.env.DB_HOST}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await rl.question("¿Continuar con el seed en esa base? (escribe si): ");
  rl.close();
  return respuesta.trim().toLowerCase() === "si";
}

// "Negro" -> "NEG" (sin acentos), para armar el sku de cada variante
const codigoColor = (color) =>
  color.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3).toUpperCase();

// Genera una variante por cada combinación de color y talla.
// La imagen depende solo del color: todas las tallas de un color comparten la misma.
function armarVariantes(p) {
  const variantes = [];
  for (const color of p.colores || [null]) {
    for (const talla of p.tallas || [null]) {
      const sku = [p.base, color && codigoColor(color), talla].filter(Boolean).join("-");
      variantes.push({
        sku,
        talla,
        color,
        imagen_url: `https://placehold.co/600x600/png?text=${encodeURIComponent([p.nombre, color].filter(Boolean).join(" "))}`,
        stock: p.ajustes?.[sku] ?? p.stock,
        stock_minimo: p.stockMinimo
      });
    }
  }
  return variantes;
}

async function seed() {
  try {
    if (!(await confirmarBase())) {
      console.log("Seed cancelado. No se cambió nada.");
      return;
    }

    // ===== Categorías raíz =====
    const [calzado] = await db.categorias.findOrCreate({
      where: { nombre: "Calzado" },
      defaults: { descripcion: "Zapatos y tenis deportivos", id_categoria_padre: null }
    });

    // Calzado es categoría raíz: si quedó apuntándose a sí misma por una prueba vieja, se corrige.
    if (calzado.id_categoria_padre !== null) {
      await calzado.update({ id_categoria_padre: null });
    }

    const [ropa] = await db.categorias.findOrCreate({
      where: { nombre: "Ropa" },
      defaults: { descripcion: "Prendas de vestir deportivas", id_categoria_padre: null }
    });

    const [accesorios] = await db.categorias.findOrCreate({
      where: { nombre: "Accesorios" },
      defaults: { descripcion: "Guantes, gorras, bolsos deportivos y otros accesorios", id_categoria_padre: null }
    });

    // Si "Accesorios" ya existía de una prueba anterior con un padre
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

    // ===== Productos con sus variantes =====
    // tallas / colores: si se omiten, el producto tiene una sola variante sin talla ni color.
    // Calzado en sistema europeo. "ajustes" fuerza el stock de una variante concreta
    // (para tener ejemplos de agotado y pocas_unidades).
    const productos = [
      { base: "TEN-RUN-001", nombre: "Tenis Running Pro", descripcion: "Tenis para correr, amortiguación media", marca: "Nike", precio_costo: 250, precio_venta: 429.99, categoria: tenisRunning, proveedor: provGT, tallas: ["39", "40", "41", "42"], colores: ["Negro", "Blanco"], stock: 6, stockMinimo: 2 },
      { base: "TEN-RUN-002", nombre: "Tenis Running Ultraboost", descripcion: "Amortiguación alta, ideal para largas distancias", marca: "Adidas", precio_costo: 380, precio_venta: 649.99, categoria: tenisRunning, proveedor: provImport, tallas: ["39", "40", "40.5", "42"], colores: ["Azul"], stock: 5, stockMinimo: 2, ajustes: { "TEN-RUN-002-AZU-42": 0 } },
      { base: "TEN-CAS-001", nombre: "Tenis Casual Urban", descripcion: "Uso diario, estilo urbano", marca: "Puma", precio_costo: 180, precio_venta: 329.99, categoria: tenisCasual, proveedor: provGT, tallas: ["38", "40", "42"], colores: ["Negro", "Gris"], stock: 5, stockMinimo: 2 },
      { base: "TEN-CAS-002", nombre: "Tenis Casual Classic", descripcion: "Diseño clásico, suela de goma", marca: "Reebok", precio_costo: 150, precio_venta: 279.99, categoria: tenisCasual, proveedor: provTex, tallas: ["38", "40", "42"], colores: ["Blanco"], stock: 6, stockMinimo: 2 },
      { base: "PLA-001", nombre: "Playera Dry-Fit Manga Corta", descripcion: "Tela transpirable, corte atlético", marca: "Nike", precio_costo: 45, precio_venta: 99.99, categoria: playeras, proveedor: provTex, tallas: ["S", "M", "L", "XL"], colores: ["Negro", "Azul"], stock: 8, stockMinimo: 3 },
      { base: "PLA-002", nombre: "Playera de Compresión", descripcion: "Ajuste ceñido, ideal para entrenamiento", marca: "Under Armour", precio_costo: 55, precio_venta: 119.99, categoria: playeras, proveedor: provTex, tallas: ["S", "M", "L"], colores: ["Negro"], stock: 6, stockMinimo: 3, ajustes: { "PLA-002-NEG-M": 2 } },
      { base: "SHO-001", nombre: "Short Deportivo", descripcion: "Short ligero con bolsillos laterales", marca: "Adidas", precio_costo: 50, precio_venta: 89.99, categoria: shorts, proveedor: provTex, tallas: ["S", "M", "L"], colores: ["Negro", "Gris"], stock: 6, stockMinimo: 3 },
      { base: "SHO-002", nombre: "Short de Compresión", descripcion: "Short interior para running", marca: "Puma", precio_costo: 40, precio_venta: 79.99, categoria: shorts, proveedor: provImport, tallas: ["S", "M", "L"], colores: ["Negro"], stock: 5, stockMinimo: 2 },
      { base: "ACC-001", nombre: "Gorra Deportiva", descripcion: "Gorra ajustable con visera curva", marca: "Nike", precio_costo: 30, precio_venta: 59.99, categoria: accesorios, proveedor: provImport, colores: ["Negro", "Rojo"], stock: 15, stockMinimo: 5 },
      { base: "ACC-002", nombre: "Guantes de Entrenamiento", descripcion: "Guantes acolchados para gimnasio", marca: "Reebok", precio_costo: 35, precio_venta: 69.99, categoria: accesorios, proveedor: provFitness, tallas: ["S", "M", "L"], colores: ["Negro"], stock: 10, stockMinimo: 3 },
      { base: "ACC-003", nombre: "Bolso Deportivo Mediano", descripcion: "Compartimento para zapatos", marca: "Adidas", precio_costo: 80, precio_venta: 149.99, categoria: accesorios, proveedor: provImport, colores: ["Negro", "Azul"], stock: 8, stockMinimo: 2 },
      { base: "ACC-004", nombre: "Medias Deportivas (Par)", descripcion: "Tela acolchada, alta transpirabilidad", marca: "Nike", precio_costo: 15, precio_venta: 34.99, categoria: accesorios, proveedor: provTex, tallas: ["M", "L"], colores: ["Blanco"], stock: 30, stockMinimo: 8 },
      { base: "EQU-001", nombre: "Mancuernas 5kg (Par)", descripcion: "Recubrimiento de neopreno", marca: "Reebok", precio_costo: 120, precio_venta: 199.99, categoria: equipamiento, proveedor: provFitness, stock: 15, stockMinimo: 4 },
      { base: "EQU-002", nombre: "Banda de Resistencia", descripcion: "Nivel de resistencia medio", marca: null, precio_costo: 25, precio_venta: 49.99, categoria: equipamiento, proveedor: provFitness, stock: 45, stockMinimo: 15 },
      { base: "EQU-003", nombre: "Cuerda para Saltar", descripcion: "Cable de acero ajustable", marca: null, precio_costo: 20, precio_venta: 39.99, categoria: equipamiento, proveedor: provFitness, stock: 55, stockMinimo: 15 },
      { base: "EQU-004", nombre: "Tapete de Yoga", descripcion: "6mm de grosor, antideslizante", marca: null, precio_costo: 60, precio_venta: 119.99, categoria: equipamiento, proveedor: provFitness, colores: ["Morado"], stock: 22, stockMinimo: 6 },
      { base: "EQU-005", nombre: "Balón Medicinal 4kg", descripcion: "Superficie texturizada antideslizante", marca: null, precio_costo: 90, precio_venta: 159.99, categoria: equipamiento, proveedor: provFitness, stock: 12, stockMinimo: 4 },
      { base: "ACC-005", nombre: "Termo Deportivo 1L", descripcion: "Doble pared, mantiene temperatura", marca: null, precio_costo: 45, precio_venta: 89.99, categoria: accesorios, proveedor: provImport, colores: ["Plateado"], stock: 38, stockMinimo: 10 }
    ];

    for (const p of productos) {
      // Producto y variantes se guardan juntos: si algo falla, no queda un producto a medias
      await db.sequelize.transaction(async (t) => {
        const [producto, creado] = await db.productos.findOrCreate({
          where: { nombre: p.nombre },
          defaults: {
            descripcion: p.descripcion,
            marca: p.marca,
            precio_costo: p.precio_costo,
            precio_venta: p.precio_venta,
            id_categoria: p.categoria.id,
            id_proveedor: p.proveedor.id
          },
          transaction: t
        });

        let variantesNuevas = 0;
        for (const v of armarVariantes(p)) {
          const [, varianteCreada] = await db.variantes.findOrCreate({
            where: { sku: v.sku },
            defaults: { ...v, id_producto: producto.id },
            transaction: t
          });
          if (varianteCreada) variantesNuevas++;
        }

        console.log(`${creado ? "Creado" : "Ya existía"}: ${producto.nombre} (${variantesNuevas} variantes nuevas)`);
      });
    }

    console.log("\n Seed completado con éxito.");
  } catch (error) {
    console.error("Error durante el seed:", error.message);
  } finally {
    await db.sequelize.close();
  }
}

seed();