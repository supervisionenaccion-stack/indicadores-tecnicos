// Sube a Supabase los datos de cada tecnico (tabla datos_tecnicos) desde la
// copia completa privado/index.html que deja generar_portal.js. El index.html
// publico va sin esos datos: el portal se los pide a Supabase con el ID.
// Se corre DESPUES de validar_portal.js, para no subir una carga mala.
//
//   node reportes/subir_datos_tecnicos.js

const fs = require("fs");
const path = require("path");
const { cargarDatosTecnicos, DIR_PRIVADO } = require("./proteger.js");

async function main() {
  const html = fs.readFileSync(path.join(DIR_PRIVADO, "index.html"), "utf-8");
  const m = html.match(/const DATA = (\{.*?\});\r?\n/s);
  if (!m) throw new Error("privado/index.html no trae el bloque de datos");
  const tecnicos = JSON.parse(m[1]).tecnicos || {};
  const n = Object.keys(tecnicos).length;
  if (!n) throw new Error("privado/index.html no trae tecnicos; no se sube nada");
  const cargados = await cargarDatosTecnicos(tecnicos);
  if (cargados !== n) throw new Error(`Supabase cargo ${cargados} de ${n} tecnicos`);
  console.log(`==> Supabase: datos de ${n} tecnicos cargados`);
}

main().catch((err) => { console.error("ERROR:", err.message); process.exit(1); });
