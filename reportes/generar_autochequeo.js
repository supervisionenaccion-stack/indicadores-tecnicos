// Estadistica del autochequeo de herramientas (Claro VTR). Se publica cifrada como
// autochequeo.html (boton en supervisor.html), detras del ingreso de supervisores;
// la copia sin cifrar queda en privado/.
//
// Lee las respuestas del Microsoft Forms desde el Excel que OneDrive mantiene
// sincronizado (no hace falta descargarlas) y cruza cada respuesta con los
// tecnicos de supervisor.html por nombre. No guarda ni muestra RUT.
// Uso: node reportes/generar_prueba_autochequeo.js   (despues de generar_portal.js)
// Otra ruta del Excel: AUTOCHEQUEO_XLSX en .env.local o en el entorno.

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { publicarProtegida } = require("./proteger.js");

const RAIZ = path.join(__dirname, "..");
const XLSX_DEFECTO = path.join(
  process.env.USERPROFILE || "",
  "OneDrive - COBRA CHILE SERVICIOS S.A",
  "Auto chequeo de Herramientas y EPP.xlsx"
);
// Columnas del Forms "Auto chequeo de Herramientas y EPP": Id, hora inicio, hora fin, correo, nombre (cuenta), NOMBRE (tecnico), RUT, agencia; desde la 9 van los items (herramientas, EPP y documentos) hasta la columna Observaciones.
const COL_INICIO = 2;
const COL_NOMBRE = 6;
const COL_PRIMERA_HERRAMIENTA = 9;

function leerEnv(clave) {
  if (process.env[clave]) return process.env[clave];
  const p = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(p)) return "";
  for (const l of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const i = l.indexOf("=");
    if (i > 0 && l.slice(0, i).trim() === clave) return l.slice(i + 1).trim();
  }
  return "";
}

function leerDataSupervisor() {
  const html = require("./proteger.js").leerSinCifrar("supervisor.html");
  const m = html.match(/const DATA = (\{.*?\});\r?\n/s);
  if (!m) throw new Error("supervisor.html: no se encontro el bloque de datos (correr antes generar_portal.js)");
  return JSON.parse(m[1]);
}

const texto = (v) => (v && v.richText ? v.richText.map((t) => t.text).join("") : v instanceof Date ? "" : String(v == null ? "" : v));
const limpiar = (s) => texto(s).replace(/\s+/g, " ").trim();

// Palabras del nombre sin tildes ni mayusculas, para comparar sin importar el orden.
function palabras(s) {
  return limpiar(s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().split(/[^A-Z]+/).filter((w) => w.length > 1);
}
function puntaje(a, b) {
  const sb = new Set(b);
  return a.filter((w) => sb.has(w)).length;
}

async function main() {
  const archivo = leerEnv("AUTOCHEQUEO_XLSX") || XLSX_DEFECTO;
  if (!fs.existsSync(archivo)) throw new Error(`No se encontro el Excel del autochequeo: ${archivo}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);
  const ws = wb.worksheets[0];

  const cab = ws.getRow(1).values.slice(1).map(limpiar);
  const herramientas = [];
  for (let c = COL_PRIMERA_HERRAMIENTA - 1; c < cab.length && !/^observaciones/i.test(cab[c]); c++) herramientas.push({ col: c + 1, nombre: cab[c] || `Columna ${c + 1}` });

  const data = leerDataSupervisor();
  const tecnicos = data.tecnicos.map((t) => ({ nombre: t.nombre, agencia: t.agencia, supervisor: t.supervisor, w: palabras(t.nombre) }));

  const respuestas = [];
  const sinCruce = new Set();
  ws.eachRow((fila, n) => {
    if (n === 1) return;
    const inicio = fila.getCell(COL_INICIO).value;
    if (!(inicio instanceof Date)) return;
    const nombre = limpiar(fila.getCell(COL_NOMBRE).value);
    const w = palabras(nombre);
    let mejor = -1, mejorPts = 0;
    tecnicos.forEach((t, i) => {
      const p = puntaje(w, t.w);
      if (p > mejorPts) { mejorPts = p; mejor = i; }
    });
    const cruza = mejorPts >= 3 || (mejorPts >= 2 && w.length <= 3);
    if (!cruza) sinCruce.add(nombre);
    let si = 0, no = 0;
    const falta = [];
    herramientas.forEach((h, k) => {
      const v = limpiar(fila.getCell(h.col).value).toUpperCase();
      if (!v) return;                                                   // sin respuesta: no cuenta
      if (v === "NO" || v === "MALO" || v === "REGULAR") { no++; falta.push(k); }   // falta o en mal estado
      else si++;                                                         // Si, Bueno, OK, Ambas, etc.
    });
    if (si + no === 0) return;
    respuestas.push({
      f: inicio.toISOString().slice(0, 10),            // fecha tal como la muestra Forms (hora local)
      t: cruza ? mejor : -1,
      n: cruza ? "" : nombre,
      si, no, x: falta,
    });
  });
  respuestas.sort((a, b) => a.f.localeCompare(b.f));

  const salida = {
    generadoEl: data.generadoEl,
    hoy: new Date().toISOString().slice(0, 10),
    archivo: path.basename(archivo),
    archivoModificado: fs.statSync(archivo).mtime.toISOString(),
    herramientas: herramientas.map((h) => h.nombre),
    tecnicos: tecnicos.map(({ nombre, agencia, supervisor }) => ({ nombre, agencia, supervisor })),
    respuestas,
  };
  const plantilla = fs.readFileSync(path.join(__dirname, "plantilla-autochequeo.html"), "utf-8");
  const estiloAcademia = fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8");
  const html = plantilla
    .replace("/*__ESTILO_ACADEMIA__*/", () => estiloAcademia)
    .replace("__DATA_AUTOCHEQUEO_JSON__", () => JSON.stringify(salida).replace(/</g, "\\u003c"));
  // Controles antes de escribir: si algo no cuadra no se toca autochequeo.html
  const errores = [];
  if (!respuestas.length) errores.push("0 respuestas en el Excel");
  if (/d{1,2}.?d{3}.?d{3}-[dkK]/.test(html)) errores.push("contiene un RUT completo");
  if (!html.trimEnd().endsWith("</html>") || html.includes("__DATA_AUTOCHEQUEO_JSON__") || html.includes("__ESTILO_ACADEMIA__")) errores.push("plantilla sin reemplazar o HTML cortado");
  if (errores.length) throw new Error("VALIDACION AUTOCHEQUEO FALLIDA: " + errores.join(" | "));
  const destino = await publicarProtegida(html, "autochequeo.html", "autochequeo", "Autochequeo de herramientas");

  const conTecnico = respuestas.filter((r) => r.t >= 0);
  console.log(`==> Generado: ${destino}`);
  console.log(
    `    PRUEBA AUTOCHEQUEO: ${respuestas.length} respuestas (${conTecnico.length} cruzadas con los ${tecnicos.length} tecnicos del portal, ` +
      `${respuestas.length - conTecnico.length} de ${sinCruce.size} personas fuera del portal) | ${herramientas.length} herramientas | ` +
      `Excel modificado ${salida.archivoModificado.slice(0, 10)}`
  );
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
