// seed-catalogo-base.js
// Deja la estructura base del catálogo: subcategorías y proveedores iniciales.
// Idempotente: busca por nombre (+ padre en categorías) y crea solo lo que falta.
// Nunca borra ni renombra categorías existentes. Todo corre en una sola transacción:
// si algo falla, se revierte todo.
// Ejecutar desde la raíz del proyecto con: node seed-catalogo-base.js
// Antes de tocar nada, muestra a qué servidor de base de datos se conectará
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

// Subcategorías a crear, agrupadas por categoría raíz
const subcategorias = [
  { padre: "Calzado", nombre: "Sandalias y chancletas", descripcion: "Sandalias, chancletas y calzado abierto" },
  { padre: "Ropa", nombre: "Sudaderas y chaquetas", descripcion: "Sudaderas, chaquetas y prendas de abrigo deportivas" },
  { padre: "Ropa", nombre: "Calcetas y medias", descripcion: "Calcetas y medias deportivas" },
  { padre: "Ropa", nombre: "Trajes de baño", descripcion: "Trajes de baño y ropa para natación" },
  { padre: "Accesorios", nombre: "Gorras", descripcion: "Gorras deportivas" },
  { padre: "Accesorios", nombre: "Mochilas y bolsos", descripcion: "Mochilas y bolsos deportivos" },
  { padre: "Accesorios", nombre: "Gafas y gorros de natación", descripcion: "Gafas y gorros para natación" },
  { padre: "Equipamiento", nombre: "Fútbol", descripcion: "Equipo para fútbol" },
  { padre: "Equipamiento", nombre: "Gimnasio", descripcion: "Equipo para gimnasio y entrenamiento" },
  { padre: "Equipamiento", nombre: "Ciclismo", descripcion: "Equipo para ciclismo" },
  { padre: "Equipamiento", nombre: "Baloncesto", descripcion: "Equipo para baloncesto" }
];

const proveedores = [
  {
    nombre_empresa: "Distribuidora Deportiva Centroamericana",
    contacto: "Roberto Castillo",
    telefono: "5555-2101",
    email: "ventas@deportivacentroamericana.com",
    direccion: "Zona 9, Ciudad de Guatemala"
  },
  {
    nombre_empresa: "Importaciones Atlas Sport",
    contacto: "Patricia Morales",
    telefono: "5555-2202",
    email: "contacto@atlassport.com",
    direccion: "Zona 11, Ciudad de Guatemala"
  },
  {
    nombre_empresa: "Textiles y Calzado del Pacífico",
    contacto: "Fernando Ortiz",
    telefono: "5555-2303",
    email: "pedidos@textilescalzadopacifico.com",
    direccion: "Escuintla, Guatemala"
  },
  {
    nombre_empresa: "Equipamiento Pro Guatemala",
    contacto: "Lucía Barrios",
    telefono: "5555-2404",
    email: "info@equipamientoproguatemala.com",
    direccion: "Zona 7, Ciudad de Guatemala"
  }
];

// ¿nuevoPadre es la propia categoría o una de sus descendientes? (misma lógica que categoria.controller.js)
async function crearCiclo(idCategoria, idNuevoPadre, transaction) {
  const visitados = new Set();
  let actual = idNuevoPadre;
  while (actual !== null && actual !== undefined && !visitados.has(actual)) {
    if (actual === idCategoria) return true;
    visitados.add(actual);
    const fila = await db.categorias.findByPk(actual, { transaction });
    actual = fila ? fila.id_categoria_padre : null;
  }
  return false;
}

async function seedCatalogoBase() {
  try {
    if (!(await confirmarBase())) {
      console.log("Seed cancelado. No se cambió nada.");
      return;
    }

    const resumen = {
      categoriasCreadas: [],
      categoriasExistentes: [],
      categoriasMovidas: [],
      proveedoresCreados: [],
      proveedoresExistentes: []
    };

    await db.sequelize.transaction(async (t) => {
      // ===== Categorías raíz (deben existir; no se crean ni se modifican) =====
      const raices = {};
      for (const nombre of new Set(subcategorias.map((s) => s.padre))) {
        const raiz = await db.categorias.findOne({
          where: { nombre, id_categoria_padre: null },
          transaction: t
        });
        if (!raiz) throw new Error(`No existe la categoría raíz "${nombre}".`);
        raices[nombre] = raiz;
      }

      // ===== Subcategorías: se crean solo si no existe nombre + padre =====
      for (const s of subcategorias) {
        const [categoria, creada] = await db.categorias.findOrCreate({
          where: { nombre: s.nombre, id_categoria_padre: raices[s.padre].id },
          defaults: { descripcion: s.descripcion },
          transaction: t
        });
        const etiqueta = `${s.nombre} (hija de ${s.padre}, id ${categoria.id})`;
        (creada ? resumen.categoriasCreadas : resumen.categoriasExistentes).push(etiqueta);
      }

      // ===== Natación: se conserva su id y solo cambia el padre a Equipamiento =====
      const equipamiento = raices["Equipamiento"];
      const natacion = await db.categorias.findAll({ where: { nombre: "Natación" }, transaction: t });
      if (natacion.length > 1) {
        throw new Error('Hay más de una categoría "Natación"; no se sabe cuál mover.');
      }
      if (natacion.length === 0) {
        const nueva = await db.categorias.create(
          { nombre: "Natación", descripcion: "Equipo para natación", id_categoria_padre: equipamiento.id },
          { transaction: t }
        );
        resumen.categoriasCreadas.push(`Natación (hija de Equipamiento, id ${nueva.id})`);
      } else if (natacion[0].id_categoria_padre === equipamiento.id) {
        resumen.categoriasExistentes.push(`Natación (hija de Equipamiento, id ${natacion[0].id})`);
      } else {
        if (await crearCiclo(natacion[0].id, equipamiento.id, t)) {
          throw new Error("Mover Natación a Equipamiento crearía un ciclo.");
        }
        await natacion[0].update({ id_categoria_padre: equipamiento.id }, { transaction: t });
        resumen.categoriasMovidas.push(`Natación (id ${natacion[0].id}) -> hija de Equipamiento`);
      }

      // ===== Proveedores: idempotente por nombre_empresa =====
      for (const p of proveedores) {
        const [proveedor, creado] = await db.proveedores.findOrCreate({
          where: { nombre_empresa: p.nombre_empresa },
          defaults: p,
          transaction: t
        });
        (creado ? resumen.proveedoresCreados : resumen.proveedoresExistentes).push(`${proveedor.nombre_empresa} (id ${proveedor.id})`);
      }
    });

    // ===== Resumen (solo se llega aquí si la transacción hizo commit) =====
    const imprimir = (titulo, lista) => {
      console.log(`\n${titulo}: ${lista.length}`);
      lista.forEach((item) => console.log(`  - ${item}`));
    };
    imprimir("Categorías creadas", resumen.categoriasCreadas);
    imprimir("Categorías que ya existían", resumen.categoriasExistentes);
    imprimir("Categorías movidas", resumen.categoriasMovidas);
    imprimir("Proveedores creados", resumen.proveedoresCreados);
    imprimir("Proveedores que ya existían", resumen.proveedoresExistentes);

    console.log("\n Seed del catálogo base completado con éxito.");
  } catch (error) {
    console.error("Error durante el seed (se revirtió todo):", error.message);
  } finally {
    await db.sequelize.close();
  }
}

seedCatalogoBase();
