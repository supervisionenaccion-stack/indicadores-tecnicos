// PRUEBA (no se publica): portal del tecnico que NO trae los datos de todos.
// Sube a Supabase los datos de cada tecnico (tomados del index.html ya
// generado) y arma prueba_portal_tecnico.html desde template.html con
// "tecnicos" vacio: al escribir el ID, la pagina pide a Supabase solo los de ese tecnico.
//
//   node reportes/generar_prueba_portal_tecnico.js

const fs = require("fs");
const path = require("path");
const { cargarDatosTecnicos, configSupabase, leerSinCifrar } = require("./proteger.js");

const RAIZ = path.join(__dirname, "..");

async function main() {
  const index = leerSinCifrar("index.html"); // copia completa de privado/
  const m = index.match(/const DATA = (\{.*?\});\r?\n/s);
  if (!m) throw new Error("index.html no trae el bloque de datos");
  const data = JSON.parse(m[1]);
  const n = await cargarDatosTecnicos(data.tecnicos);
  console.log(`==> Supabase: datos de ${n} tecnicos cargados`);

  const cfg = configSupabase();
  const sinTecnicos = { ...data, tecnicos: {} };
  const html = fs.readFileSync(path.join(RAIZ, "template.html"), "utf-8")
    .replace("__DATA_JSON__", () => JSON.stringify(sinTecnicos).replace(/</g, "\\u003c"))
    .replace("__SUPABASE_URL__", () => cfg.url)
    .replace("__SUPABASE_KEY__", () => cfg.anonKey)
    .replace("<title>", "<title>PRUEBA · ");
  if (/"nombre"\s*:/.test(html)) throw new Error("la prueba todavia trae datos de tecnicos");
  fs.writeFileSync(path.join(RAIZ, "prueba_portal_tecnico.html"), html, "utf-8");
  console.log("==> Generado: prueba_portal_tecnico.html (sin datos de tecnicos dentro; no se publica)");
}

main().catch((err) => { console.error("ERROR:", err.message); process.exit(1); });
