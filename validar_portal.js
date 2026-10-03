// Revisa index.html y supervisor.html recien generados ANTES de publicarlos.
// Si algo no cuadra, sale con codigo 1 y el motivo, y Actualizar_Automatico.ps1
// no sube nada (el sitio publico se queda con la ultima version buena).
// Uso: node validar_portal.js

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { leerSinCifrar, estaCifrada } = require("./reportes/proteger.js");

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// Si la cantidad de tecnicos cae mas que esto respecto de lo ya publicado, se
// asume una carga incompleta de la BD y no se publica.
const CAIDA_MAXIMA_TECNICOS = 0.2;

function extraerData(html, archivo) {
  const m = html.match(/const DATA = (\{.*?\});\r?\n/s);
  if (!m) throw new Error(`${archivo}: no se encontro el bloque de datos`);
  return JSON.parse(m[1]);
}
function contarTecnicos(data) {
  return Array.isArray(data.tecnicos) ? data.tecnicos.length : Object.keys(data.tecnicos || {}).length;
}
function publicadoEnGit(archivo) {
  try {
    return execFileSync("git", ["show", `HEAD:${archivo}`], { cwd: __dirname, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

const errores = [];
const hoy = new Date();
const hoyEsCl = `${String(hoy.getDate()).padStart(2, "0")}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${hoy.getFullYear()}`;
// El dia 1 el portal muestra el cierre del mes anterior (ver fechaReferencia()
// en generar_portal.js): los periodos esperados se corren un mes hacia atras.
// PORTAL_HOY=AAAA-MM-DD simula otra fecha, solo para probar cambios de mes.
const simulada = /^\d{4}-\d{2}-\d{2}$/.test(process.env.PORTAL_HOY || "") ? new Date(process.env.PORTAL_HOY + "T12:00:00") : null;
const base = simulada || hoy;
const ref = base.getDate() === 1 ? new Date(base.getFullYear(), base.getMonth(), 0) : base;
const mesActual = `${MESES[ref.getMonth()]} de ${ref.getFullYear()}`;
const anterior = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
const mesAnterior = `${MESES[anterior.getMonth()]} de ${anterior.getFullYear()}`;

const resumen = {};
for (const archivo of ["index.html", "supervisor.html"]) {
  try {
    // supervisor.html se publica cifrado: se valida la copia sin cifrar de privado/.
    const html = archivo === "index.html" ? fs.readFileSync(path.join(__dirname, archivo), "utf-8") : leerSinCifrar(archivo);
    if (html.includes("__DATA_JSON__") || html.includes("__DATA_SUPERVISOR_JSON__")) errores.push(`${archivo}: quedo la marca de plantilla sin reemplazar`);
    if (!html.trimEnd().endsWith("</html>")) errores.push(`${archivo}: el HTML esta cortado`);
    if (/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/.test(html)) errores.push(`${archivo}: contiene un RUT completo`);

    const data = extraerData(html, archivo);
    const n = contarTecnicos(data);
    resumen[archivo] = { n, data };
    if (n === 0) errores.push(`${archivo}: 0 tecnicos`);
    if (!String(data.generadoEl || "").startsWith(hoyEsCl)) errores.push(`${archivo}: fecha de generacion "${data.generadoEl}" no es de hoy (${hoyEsCl})`);
    if (!String(data.periodoMatriz || "").endsWith(mesActual)) errores.push(`${archivo}: periodo Derivaciones/RGU "${data.periodoMatriz}" no es ${mesActual}`);
    if (data.periodoCalidad !== mesAnterior) errores.push(`${archivo}: periodo Calidad "${data.periodoCalidad}" no es ${mesAnterior}`);

    // Solo index.html: el supervisor.html publicado va cifrado (y debe tener
    // la misma cantidad de tecnicos que index.html, se revisa mas abajo).
    const previo = archivo === "index.html" ? publicadoEnGit(archivo) : null;
    if (previo) {
      const nPrevio = contarTecnicos(extraerData(previo, `${archivo} (publicado)`));
      resumen[archivo].nPrevio = nPrevio;
      if (nPrevio > 0 && n < nPrevio * (1 - CAIDA_MAXIMA_TECNICOS)) {
        errores.push(`${archivo}: bajo de ${nPrevio} a ${n} tecnicos (posible carga incompleta de la BD)`);
      }
    }
  } catch (err) {
    errores.push(`${archivo}: ${err.message}`);
  }
}

if (resumen["index.html"] && resumen["supervisor.html"] && resumen["index.html"].n !== resumen["supervisor.html"].n) {
  errores.push(`index.html tiene ${resumen["index.html"].n} tecnicos y supervisor.html ${resumen["supervisor.html"].n}`);
}

// Las paginas de supervisores solo se publican cifradas (ingreso con usuario y clave).
for (const archivo of ["supervisor.html", "reiteradas.html", "vecino.html", "auditorias.html"]) {
  const ruta = path.join(__dirname, archivo);
  if (!fs.existsSync(ruta)) continue;
  const html = fs.readFileSync(ruta, "utf-8");
  if (!estaCifrada(html) || /const DATA|"nombre"s*:/.test(html)) errores.push(`${archivo}: no esta cifrado; no se puede publicar`);
  if (/sb_secret_|service_role/.test(html)) errores.push(`${archivo}: contiene la llave secreta de Supabase`);
}

if (errores.length) {
  console.error("VALIDACION FALLIDA:\n - " + errores.join("\n - "));
  process.exit(1);
}
const d = resumen["index.html"].data;
console.log(`VALIDACION OK: ${resumen["index.html"].n} tecnicos | Calidad: ${d.periodoCalidad} | Derivaciones/RGU: ${d.periodoMatriz} | generado ${d.generadoEl}`);
