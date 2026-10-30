// seed-productos-tanda1.js
// Carga la primera tanda de 25 productos con sus variantes y el stock inicial de cada una.
// Idempotente: producto por nombre + marca + genero, variante por sku. Nunca borra ni
// modifica lo existente. Categorías y proveedores se buscan por nombre y deben existir.
// Todo corre en una sola transacción: si algo falla, se revierte todo.
// Ejecutar desde la raíz del proyecto con: node seed-productos-tanda1.js
// Antes de tocar nada, muestra a qué servidor de base de datos se conectará
// y pide confirmación.

require("dotenv").config({ path: `.env.${process.env.NODE_ENV || "development"}` });
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const db = require("./app/models");
const { registrarStockInicial } = require("./app/services/inventario.service.js");

const CARPETA_IMAGENES = path.resolve(__dirname, "../EngineSport-frontend/public/img/productos");
const STOCK_MINIMO = 3;

async function confirmarBase() {
  console.log(`\nBase de datos destino: ${process.env.DB_HOST}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await rl.question("¿Continuar con el seed en esa base? (escribe si): ");
  rl.close();
  return respuesta.trim().toLowerCase() === "si";
}

// "Azul" -> "azul", "Pacífico" -> "pacifico" (sin acentos, minúsculas)
const sinAcentos = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "Negro" -> "NEG", para armar el sku de cada variante
const codigoColor = (color) => sinAcentos(color).slice(0, 3).toUpperCase();

// Tallas numéricas de calzado: rango(40, 44) -> ["40", "41", ..., "44"]
const rango = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => String(desde + i));

const TALLAS_XS_L = ["XS", "S", "M", "L"];
const TALLAS_S_XL = ["S", "M", "L", "XL"];
const UNICA = [null]; // talla "única" = talla NULL

const TP = "Textiles y Calzado del Pacífico";
const DD = "Distribuidora Deportiva Centroamericana";
const AT = "Importaciones Atlas Sport";
const EP = "Equipamiento Pro Guatemala";

// numero: el pXX de sku e imagen. stock: 20 por defecto, 15 en balones y mancuernas.
const productos = [
  { numero: 1, nombre: "Tenis de running ligeros de hombre", categoria: "Tenis para correr", genero: "hombre", marca: "Nike", proveedor: TP, costo: 280, venta: 449.99, colores: ["Negro", "Azul"], tallas: rango(40, 44) },
  { numero: 2, nombre: "Tenis de running ligeros de mujer", categoria: "Tenis para correr", genero: "mujer", marca: "Adidas", proveedor: TP, costo: 270, venta: 429.99, colores: ["Blanco", "Morado"], tallas: rango(36, 40) },
  { numero: 3, nombre: "Tenis de running amortiguados", categoria: "Tenis para correr", genero: "unisex", marca: "Puma", proveedor: TP, costo: 300, venta: 479.99, colores: ["Gris", "Rojo"], tallas: rango(38, 43) },
  { numero: 4, nombre: "Tenis casuales de lona", categoria: "Tenis casuales", genero: "hombre", marca: "Reebok", proveedor: TP, costo: 180, venta: 299.99, colores: ["Blanco", "Negro"], tallas: rango(40, 44) },
  { numero: 5, nombre: "Tenis casuales urbanos", categoria: "Tenis casuales", genero: "mujer", marca: "Adidas", proveedor: TP, costo: 190, venta: 319.99, colores: ["Blanco", "Gris"], tallas: rango(36, 40) },
  { numero: 6, nombre: "Chancletas deportivas", categoria: "Sandalias y chancletas", genero: "unisex", marca: "Under Armour", proveedor: TP, costo: 45, venta: 89.99, colores: ["Negro", "Azul"], tallas: rango(38, 44) },
  { numero: 7, nombre: "Sandalias deportivas", categoria: "Sandalias y chancletas", genero: "mujer", marca: "Nike", proveedor: TP, costo: 90, venta: 159.99, colores: ["Negro", "Blanco"], tallas: rango(36, 40) },
  { numero: 8, nombre: "Playera de entrenamiento", categoria: "Playeras", genero: "hombre", marca: "Nike", proveedor: DD, costo: 60, venta: 119.99, colores: ["Negro", "Azul", "Gris"], tallas: TALLAS_S_XL },
  { numero: 9, nombre: "Playera transpirable", categoria: "Playeras", genero: "mujer", marca: "Adidas", proveedor: DD, costo: 55, venta: 109.99, colores: ["Blanco", "Morado"], tallas: TALLAS_XS_L },
  { numero: 10, nombre: "Playera de compresión", categoria: "Playeras", genero: "hombre", marca: "Under Armour", proveedor: DD, costo: 75, venta: 139.99, colores: ["Negro", "Rojo"], tallas: TALLAS_S_XL },
  { numero: 11, nombre: "Short de running", categoria: "Shorts", genero: "hombre", marca: "Puma", proveedor: DD, costo: 50, venta: 99.99, colores: ["Negro", "Azul"], tallas: TALLAS_S_XL },
  { numero: 12, nombre: "Short deportivo", categoria: "Shorts", genero: "mujer", marca: "Reebok", proveedor: DD, costo: 45, venta: 89.99, colores: ["Gris", "Negro"], tallas: TALLAS_XS_L },
  { numero: 13, nombre: "Sudadera con capucha", categoria: "Sudaderas y chaquetas", genero: "unisex", marca: "Adidas", proveedor: DD, costo: 140, venta: 259.99, colores: ["Gris", "Negro"], tallas: TALLAS_S_XL },
  { numero: 14, nombre: "Chaqueta cortavientos de hombre", categoria: "Sudaderas y chaquetas", genero: "hombre", marca: "Nike", proveedor: DD, costo: 160, venta: 289.99, colores: ["Azul", "Negro"], tallas: TALLAS_S_XL },
  { numero: 15, nombre: "Chaqueta ligera de entrenamiento de mujer", categoria: "Sudaderas y chaquetas", genero: "mujer", marca: "Puma", proveedor: DD, costo: 150, venta: 269.99, colores: ["Negro", "Morado"], tallas: TALLAS_XS_L },
  { numero: 16, nombre: "Calcetas deportivas (paquete de 3)", categoria: "Calcetas y medias", genero: "unisex", marca: "Under Armour", proveedor: DD, costo: 20, venta: 44.99, colores: ["Blanco", "Negro"], tallas: ["M", "L"] },
  { numero: 17, nombre: "Traje de baño de competencia", categoria: "Trajes de baño", genero: "hombre", marca: "Under Armour", proveedor: DD, costo: 80, venta: 149.99, colores: ["Negro", "Azul"], tallas: TALLAS_S_XL },
  { numero: 18, nombre: "Traje de baño entero", categoria: "Trajes de baño", genero: "mujer", marca: "Adidas", proveedor: DD, costo: 90, venta: 169.99, colores: ["Negro", "Azul"], tallas: TALLAS_XS_L },
  { numero: 19, nombre: "Gorra deportiva", categoria: "Gorras", genero: "unisex", marca: "Nike", proveedor: AT, costo: 30, venta: 64.99, colores: ["Negro", "Blanco"], tallas: UNICA },
  { numero: 20, nombre: "Mochila deportiva", categoria: "Mochilas y bolsos", genero: "unisex", marca: "Puma", proveedor: AT, costo: 85, venta: 159.99, colores: ["Negro", "Gris"], tallas: UNICA },
  { numero: 21, nombre: "Bolso de gimnasio", categoria: "Mochilas y bolsos", genero: "hombre", marca: "Under Armour", proveedor: AT, costo: 95, venta: 179.99, colores: ["Negro", "Rojo"], tallas: UNICA },
  { numero: 22, nombre: "Gafas de natación", categoria: "Gafas y gorros de natación", genero: "unisex", marca: "Adidas", proveedor: AT, costo: 25, venta: 54.99, colores: ["Azul", "Negro"], tallas: UNICA },
  { numero: 23, nombre: "Balón de fútbol", categoria: "Fútbol", genero: "unisex", marca: "Adidas", proveedor: EP, costo: 70, venta: 129.99, colores: ["Blanco"], tallas: UNICA, stock: 15 },
  { numero: 24, nombre: "Mancuernas de neopreno 5 kg (par)", categoria: "Gimnasio", genero: "mujer", marca: "Reebok", proveedor: EP, costo: 80, venta: 149.99, colores: ["Morado", "Gris"], tallas: UNICA, stock: 15 },
  { numero: 25, nombre: "Balón de baloncesto", categoria: "Baloncesto", genero: "hombre", marca: "Nike", proveedor: EP, costo: 75, venta: 139.99, colores: ["Naranja"], tallas: UNICA, stock: 15 }
];

// Genera una variante por cada combinación de color y talla.
// Sku: P01-NEG-40 (sin talla si es única). La imagen depende solo del color.
function armarVariantes(p) {
  const prefijo = `P${String(p.numero).padStart(2, "0")}`;
  const variantes = [];
  for (const color of p.colores) {
    for (const talla of p.tallas) {
      variantes.push({
        sku: [prefijo, codigoColor(color), talla].filter(Boolean).join("-"),
        talla,
        color,
        imagen_url: `/img/productos/${prefijo.toLowerCase()}-${sinAcentos(color)}.webp`,
        stock: p.stock ?? 20,
        stock_minimo: STOCK_MINIMO
      });
    }
  }
  return variantes;
}

// Validaciones en memoria: devuelve la lista de errores (vacía si todo está bien)
function validarDatos() {
  const errores = [];
  const skus = new Set();
  const productosVistos = new Set();
  const hayCarpeta = fs.existsSync(CARPETA_IMAGENES);

  if (!hayCarpeta) {
    console.warn(`Advertencia: no existe ${CARPETA_IMAGENES}; no se validan las imágenes.`);
  }

  for (const p of productos) {
    if (!(p.venta > p.costo)) {
      errores.push(`${p.nombre}: precio_venta (${p.venta}) debe ser mayor que precio_costo (${p.costo}).`);
    }
    if (!["hombre", "mujer", "unisex"].includes(p.genero)) {
      errores.push(`${p.nombre}: genero inválido "${p.genero}".`);
    }
    const clave = `${p.nombre}|${p.marca}|${p.genero}`;
    if (productosVistos.has(clave)) errores.push(`Producto repetido: ${p.nombre} (${p.marca}, ${p.genero}).`);
    productosVistos.add(clave);

    for (const v of armarVariantes(p)) {
      if (skus.has(v.sku)) errores.push(`sku repetido: ${v.sku}`);
      skus.add(v.sku);
      if (hayCarpeta && !fs.existsSync(path.join(CARPETA_IMAGENES, path.basename(v.imagen_url)))) {
        errores.push(`No existe la imagen ${path.basename(v.imagen_url)} (sku ${v.sku}).`);
      }
    }
  }
  return errores;
}

// Busca una fila por nombre; falla si no existe o si hay más de una
async function buscarPorNombre(modelo, campo, valor, etiqueta, transaction) {
  const filas = await modelo.findAll({ where: { [campo]: valor }, transaction });
  if (filas.length === 0) throw new Error(`No existe ${etiqueta} "${valor}".`);
  if (filas.length > 1) throw new Error(`Hay más de ${etiqueta} llamado "${valor}"; no se sabe cuál usar.`);
  return filas[0];
}

async function seedProductosTanda1() {
  try {
    const errores = validarDatos();
    if (errores.length > 0) {
      console.error("Validación fallida, no se tocó la base:");
      errores.forEach((e) => console.error(`  - ${e}`));
      return;
    }

    if (!(await confirmarBase())) {
      console.log("Seed cancelado. No se cambió nada.");
      return;
    }

    const resumen = { productosCreados: 0, productosExistentes: 0, variantesCreadas: 0, variantesExistentes: 0 };

    await db.sequelize.transaction(async (t) => {
      // Categorías y proveedores: deben existir todos antes de insertar nada
      const categorias = {};
      for (const nombre of new Set(productos.map((p) => p.categoria))) {
        categorias[nombre] = await buscarPorNombre(db.categorias, "nombre", nombre, "la categoría", t);
      }
      const proveedores = {};
      for (const nombre of new Set(productos.map((p) => p.proveedor))) {
        proveedores[nombre] = await buscarPorNombre(db.proveedores, "nombre_empresa", nombre, "el proveedor", t);
      }

      for (const p of productos) {
        const [producto, creado] = await db.productos.findOrCreate({
          where: { nombre: p.nombre, marca: p.marca, genero: p.genero },
          defaults: {
            precio_costo: p.costo,
            precio_venta: p.venta,
            activo: true,
            id_categoria: categorias[p.categoria].id,
            id_proveedor: proveedores[p.proveedor].id
          },
          transaction: t
        });
        resumen[creado ? "productosCreados" : "productosExistentes"]++;

        let variantesNuevas = 0;
        for (const v of armarVariantes(p)) {
          const [variante, varianteCreada] = await db.variantes.findOrCreate({
            where: { sku: v.sku },
            defaults: { ...v, id_producto: producto.id, activo: true },
            transaction: t
          });
          if (varianteCreada) {
            variantesNuevas++;
            resumen.variantesCreadas++;
            // Solo las variantes que se crean ahora reciben su entrada de inventario
            await registrarStockInicial([variante], t);
          } else {
            resumen.variantesExistentes++;
          }
        }

        console.log(`${creado ? "Creado" : "Ya existía"}: ${producto.nombre} (${variantesNuevas} variantes nuevas)`);
      }
    });

    // Solo se llega aquí si la transacción hizo commit
    console.log(`\nProductos: ${resumen.productosCreados} creados, ${resumen.productosExistentes} ya existían.`);
    console.log(`Variantes: ${resumen.variantesCreadas} creadas, ${resumen.variantesExistentes} ya existían.`);
    console.log("\n Seed de productos (tanda 1) completado con éxito.");
  } catch (error) {
    console.error("Error durante el seed (se revirtió todo):", error.message);
  } finally {
    await db.sequelize.close();
  }
}

seedProductosTanda1();
