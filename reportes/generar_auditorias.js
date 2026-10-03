// Pagina de auditorias de terreno para supervisores (auditorias.html).
//
// Lee las respuestas del formulario de Google que ya descarga cada manana el
// proyecto AuditoriasTerreno (data\BBDD_Supervisores.xlsx, tarea de las 8:45)
// y arma la pagina con el formato del portal. No consulta la base SQL.
//
//   node reportes/generar_auditorias.js prueba  -> prueba_auditorias.html (no se publica)
//   node reportes/generar_auditorias.js         -> auditorias.html cifrada (+ copia en privado/)
//
// Ruta del Excel: AUDITORIAS_XLSX en .env.local, o la carpeta de siempre.

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { publicarProtegida, protegerPaginaPrueba, leerEnv } = require("./proteger.js");

const RAIZ = path.join(__dirname, "..");
const CARPETA_AUDITORIAS = "C:/Bases_Vtr/AuditoriasTerreno/data";
// Meta acordada en el dashboard anterior: 2 auditorias por supervisor cada dia habil.
const META_DIARIA = 2;
// Supervisores que cuentan para la meta: los que auditaron en los ultimos dias.
const DIAS_SUPERVISOR_ACTIVO = 45;

// Encabezados del formulario (se comparan sin mayusculas ni espacios de mas,
// porque Google Forms deja espacios al final y cambia mayusculas).
const COLUMNAS = {
  fecha: "Marca temporal",
  puntuacion: "Puntuación",
  peticion: "N° PETICIÓN",
  tecnico: "Nombre Técnico",
  supervisor: "SUPERVISOR",
  tipo: "Auditoria",
  actividad: "Actividad",
  direccion: "DIRECCIÓN (Calle - Numero)",
  estetica: "Nota de Estética del cableado",
  estado: "Estado Auditoria",
  funcion: "Técnico cumple correctamente con su función?",
  nota: "Con que nota se evalúa al técnico",
  obs: "Observaciones (detallar observaciones)",
  pasamuros: "Instala Pasa-muros",
  roseta: "Roseta Óptica en norma y atornillada",
  limpio: "Deja Área de Trabajo Limpio",
  capacitacion: "Capacitación al Cliente",
  alcohol: "Utiliza Alcohol isopropilico",
  oneclick: "Utiliza OneClick para realizar limpieza a conectores",
  dropSoportes: "Instala drop con soportes",
  dropNorma: "Drop se encuentra encuentra dentro de norma de instalaciones",
  reutiliza: "Reutiliza Instalación",
  reutilizaOtra: "Reutiliza Instalación de otra compañía",
  mesa: "Se llevó a cabo la mesa de trabajo.",
  cierre: "Se cerró el proceso con el técnico?",
  obsCierre: "Observaciones",
};
const NUMERICAS = new Set(["puntuacion", "estetica", "nota"]);
// Nombres mal escritos en el formulario -> nombre correcto.
const CORRECCIONES = { "ROLANDO MOTOYA": "ROLANDO MONTOYA" };
const RUT_COMPLETO = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;

const normalizar = (s) => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
function textoCelda(v) {
  if (v == null) return "";
  if (typeof v === "object" && Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "text" in v) return String(v.text);
  if (typeof v === "object" && "result" in v) return String(v.result == null ? "" : v.result);
  return String(v);
}
// Texto libre del formulario: sin espacios de mas y sin RUT completos.
const limpiar = (s) => textoCelda(s).replace(/\s+/g, " ").trim().replace(RUT_COMPLETO, "(RUT)");

function fechaIso(v) {
  // ExcelJS entrega la hora del formulario como si fuera UTC: se toma tal cual.
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(textoCelda(v).trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

async function leerAuditorias(ruta) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const ws = wb.worksheets[0];
  const encabezados = {};
  ws.getRow(1).eachCell((celda, col) => {
    const nombre = normalizar(textoCelda(celda.value));
    // Si un encabezado se repite (hay dos "Observaciones"), vale la primera aparicion exacta.
    if (!(nombre in encabezados)) encabezados[nombre] = col;
  });
  const faltan = Object.entries(COLUMNAS).filter(([, nombre]) => !(normalizar(nombre) in encabezados)).map(([, n]) => n);
  if (faltan.length) throw new Error("Al Excel le faltan columnas del formulario: " + faltan.join(", "));

  const auditorias = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const fila = ws.getRow(r);
    const a = {};
    for (const [campo, nombre] of Object.entries(COLUMNAS)) {
      const v = fila.getCell(encabezados[normalizar(nombre)]).value;
      if (campo === "fecha") a.fecha = fechaIso(v);
      else if (NUMERICAS.has(campo)) { const x = parseFloat(textoCelda(v).replace(",", ".")); a[campo] = isNaN(x) ? 0 : x; }
      else a[campo] = limpiar(v);
    }
    if (!a.fecha) continue;
    a.tecnico = (a.tecnico || "Sin nombre").toUpperCase();
    a.supervisor = (a.supervisor || "Sin supervisor").toUpperCase();
    a.tecnico = CORRECCIONES[a.tecnico] || a.tecnico;
    a.supervisor = CORRECCIONES[a.supervisor] || a.supervisor;
    auditorias.push(a);
  }
  return auditorias.sort((x, y) => y.fecha.localeCompare(x.fecha));
}

function feriados() {
  const p = path.join(RAIZ, "Feriados.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")).map((f) => f.fecha) : [];
}

async function main() {
  const prueba = process.argv[2] === "prueba";
  const env = leerEnv();
  const rutaExcel = env.AUDITORIAS_XLSX || path.join(CARPETA_AUDITORIAS, "BBDD_Supervisores.xlsx");
  const rutaFecha = path.join(path.dirname(rutaExcel), "actualizado.txt");

  const auditorias = await leerAuditorias(rutaExcel);
  const desde = new Date(Date.now() - DIAS_SUPERVISOR_ACTIVO * 86400000).toISOString().slice(0, 10);
  const data = {
    generadoEl: new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" }),
    actualizado: fs.existsSync(rutaFecha) ? fs.readFileSync(rutaFecha, "utf-8").trim() : "sin dato",
    metaDiaria: META_DIARIA,
    feriados: feriados(),
    supervisoresMeta: [...new Set(auditorias.filter((a) => a.fecha >= desde).map((a) => a.supervisor))].sort(),
    auditorias,
  };

  const plantilla = fs.readFileSync(path.join(__dirname, "plantilla-auditorias.html"), "utf-8");
  const estiloAcademia = fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8");
  const html = plantilla
    .replace("/*__ESTILO_ACADEMIA__*/", () => estiloAcademia)
    .replace("__LOGO_DATAURI__", () => "data:image/png;base64," + fs.readFileSync(path.join(RAIZ, "logo-cobra.png")).toString("base64"))
    .replace("/*__DATA__*/null", () => JSON.stringify(data).replace(/</g, "\\u003c"));

  // Controles antes de escribir: si algo no cuadra no se toca la pagina publicada.
  const errores = [];
  if (!auditorias.length) errores.push("0 auditorias");
  if (RUT_COMPLETO.test(html)) errores.push("contiene un RUT completo");
  if (!html.trimEnd().endsWith("</html>") || /__ESTILO_ACADEMIA__|__LOGO_DATAURI__|\/\*__DATA__\*\//.test(html)) errores.push("plantilla sin reemplazar o HTML cortado");
  if (errores.length) {
    console.error("VALIDACION AUDITORIAS FALLIDA: " + errores.join(" | "));
    process.exit(1);
  }

  if (prueba) {
    fs.writeFileSync(path.join(RAIZ, "prueba_auditorias.html"), protegerPaginaPrueba(html, "auditorias", "Auditorías de terreno"), "utf-8");
    console.log("==> Generado: prueba_auditorias.html (no se publica)");
  } else {
    console.log("==> Generado: " + (await publicarProtegida(html, "auditorias.html", "auditorias", "Auditorías de terreno")));
  }
  const meses = {};
  for (const a of auditorias) meses[a.fecha.slice(0, 7)] = (meses[a.fecha.slice(0, 7)] || 0) + 1;
  console.log(`    AUDITORIAS OK: ${auditorias.length} auditorias | ${Object.entries(meses).map(([m, c]) => m + ": " + c).join(", ")} | supervisores con meta: ${data.supervisoresMeta.join(", ")} | datos al ${data.actualizado}`);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
