// Consulta de Estado Vecino: % de ordenes completadas en las que el tecnico
// hizo la consulta, por tecnico y por mes. Solo lectura sobre la BD.
// Uso: node reportes/generar_vecino.js  ->  vecino.html (se publica)
//  - vecino.html se abre desde el boton "Consulta de estado vecino" de
//    supervisor.html, con el supervisor seleccionado (vecino.html?supervisor=...).
//  - El portal del tecnico NO enlaza a vecino.html: generar_portal.js usa
//    obtenerVecino() de este archivo y deja en index.html solo los datos de
//    cada tecnico, para que cada uno vea unicamente su cumplimiento.
// Lo corre Actualizar_Automatico.ps1 todos los dias despues de generar_portal.js.
//
// Criterio (validado con el usuario el 02-10-2026):
//  - La consulta es obligatoria en toda orden completada de los tipos de
//    TIPOS_CON_CONSULTA. Meta: 100%.
//  - "Hizo la consulta" = la orden tiene algun resultado en
//    MATRIZ_VTR.[Flag Consulta Vecino] (OK, NOK o En Proceso). Vacio = no la hizo.
//  - Se usa MATRIZ_VTR y no MATRIZ_VTR_VECINOS: esa tabla es una copia
//    parcial que solo trae las consultas OK.

const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const { publicarProtegida } = require("./proteger.js");

const RAIZ = path.join(__dirname, "..");
const META = 100;
// Modificacion de Servicio y Upgrade quedan fuera: ahi la consulta nunca
// aparece registrada (0% en todos los tecnicos), asi que no parece aplicar.
const TIPOS_CON_CONSULTA = ["Alta", "Migración", "Reparación", "Alta Traslado"];
// El historial mes a mes parte en agosto de 2026 (pedido del usuario).
const INICIO_HISTORIAL = "2026-08-01";
// Supervisores que ya no tienen equipo en la operacion: ni ellos ni sus
// tecnicos aparecen en el reporte (solo figuraban en meses antiguos).
const SUPERVISORES_EXCLUIDOS = new Set(["MANUEL ALEJANDRO FLORES RIVERA", "PATRICIO ANTONIO POBLETE POBLETE"]);

function loadEnvLocal() {
  const envPath = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!(key in process.env)) process.env[key] = trimmed.slice(idx + 1).trim();
  }
}

function toSqlDate(d) {
  return d.toISOString().slice(0, 10);
}
function normalizeRut(rut) {
  return String(rut).trim().toUpperCase().replace(/\./g, "").replace(/-/g, "");
}
function leerJson(nombre) {
  const p = path.join(RAIZ, nombre);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : [];
}

// "Hoy" local como medianoche UTC; el dia 1 se usa el ultimo dia del mes
// anterior, para mostrar el cierre igual que el resto del portal.
// PORTAL_HOY=AAAA-MM-DD simula otra fecha, solo para probar cambios de mes.
function fechas() {
  const ahora = new Date();
  let hoy = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
  if (/^\d{4}-\d{2}-\d{2}$/.test(process.env.PORTAL_HOY || "")) hoy = new Date(process.env.PORTAL_HOY + "T00:00:00.000Z");
  const referencia = hoy.getUTCDate() === 1 ? new Date(hoy.getTime() - 86400000) : hoy;
  return {
    ahora,
    desde: INICIO_HISTORIAL,
    hasta: toSqlDate(new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1, 1))),
    mesInicial: toSqlDate(referencia).slice(0, 7),
  };
}

async function fetchSupervisores(pool) {
  const result = await pool.request().query(`SELECT RUT_TECNICO, TECNICO, AGENCIA, SUPERVISOR FROM SUPERVISORES_VTR`);
  const overrides = leerJson("Supervisor_Temporal.json").filter((o) => o.activo);
  const map = new Map();
  for (const row of result.recordset) {
    const override = overrides.find((o) => row.SUPERVISOR === o.supervisorOriginal);
    if (override) row.SUPERVISOR = override.supervisorTemporal;
    map.set(normalizeRut(row.RUT_TECNICO), row);
  }
  return map;
}

// Mismo filtro base que el portal (tecnicos Cobra, con Orden de Trabajo); el
// tipo de actividad y el calculo se resuelven en JS.
async function fetchCompletadas(pool, desdeStr, hastaStr) {
  const result = await pool
    .request()
    .input("desde", sql.Date, desdeStr)
    .input("hasta", sql.Date, hastaStr).query(`
    SELECT [Rut o Bucket] AS Rut_Tecnico, Fecha, [Orden de Trabajo], [Tipo de Actividad], [Flag Consulta Vecino]
    FROM MATRIZ_VTR
    WHERE Fecha >= @desde AND Fecha < @hasta
      AND (Tecnico LIKE '%cobr%' OR Tecnico LIKE '%cbr%')
      AND [Orden de Trabajo] IS NOT NULL
      AND Estado = 'Completado'
  `);
  return result.recordset;
}

// Devuelve { ultimoDia, mesInicial, meta, tipos, meses: [{ mes, tecnicos: Map(rut normalizado -> resumen) }] }.
// Los resumenes no llevan RUT: quien los publique decide con que clave.
function calcularVecino(filas, supervisores, mesInicial) {
  const rutsBaja = new Set(leerJson("Tecnicos_Baja_NO_SUBIR.json").map((t) => normalizeRut(t.rut)));
  const tipos = new Set(TIPOS_CON_CONSULTA);

  const porMes = new Map(); // "yyyy-mm" -> Map(rut -> resumen del tecnico en ese mes)
  let ultimoDia = null;
  for (const row of filas) {
    if (!tipos.has(row["Tipo de Actividad"])) continue;
    const rut = normalizeRut(row.Rut_Tecnico);
    const sup = supervisores.get(rut);
    if (!sup || rutsBaja.has(rut) || SUPERVISORES_EXCLUIDOS.has(sup.SUPERVISOR)) continue;

    const fecha = toSqlDate(new Date(row.Fecha));
    if (!ultimoDia || fecha > ultimoDia) ultimoDia = fecha;
    const mes = fecha.slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, new Map());
    const tecnicos = porMes.get(mes);
    if (!tecnicos.has(rut)) {
      tecnicos.set(rut, {
        nombre: sup.TECNICO,
        agencia: sup.AGENCIA,
        supervisor: sup.SUPERVISOR,
        total: 0,
        conConsulta: 0,
        nok: 0,
        porTipo: {},
        sinConsulta: [],
      });
    }
    const t = tecnicos.get(rut);
    const flag = String(row["Flag Consulta Vecino"] || "").trim();
    const tipo = row["Tipo de Actividad"];
    t.porTipo[tipo] = t.porTipo[tipo] || { total: 0, conConsulta: 0 };
    t.total += 1;
    t.porTipo[tipo].total += 1;
    if (flag) {
      t.conConsulta += 1;
      t.porTipo[tipo].conConsulta += 1;
      if (flag.toUpperCase() === "NOK") t.nok += 1;
    } else {
      t.sinConsulta.push({ fecha, tipo, orden: row["Orden de Trabajo"] });
    }
  }
  for (const tecnicos of porMes.values()) {
    for (const t of tecnicos.values()) t.sinConsulta.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }

  const meses = [...porMes.keys()].sort();
  return {
    ultimoDia,
    mesInicial: porMes.has(mesInicial) ? mesInicial : meses[meses.length - 1] || null,
    meta: META,
    tipos: TIPOS_CON_CONSULTA,
    meses: meses.map((mes) => ({ mes, tecnicos: porMes.get(mes) })),
  };
}

// Consulta la BD con un pool ya abierto y devuelve el calculo completo.
async function obtenerVecino(pool, supervisores) {
  const f = fechas();
  const filas = await fetchCompletadas(pool, f.desde, f.hasta);
  return calcularVecino(filas, supervisores, f.mesInicial);
}

async function main() {
  loadEnvLocal();
  const config = {
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || "1433", 10),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 900000 },
  };
  const f = fechas();
  console.log(`==> Conectando... (MATRIZ_VTR completadas ${f.desde} a ${f.hasta})`);
  const pool = await new sql.ConnectionPool(config).connect();
  const supervisores = await fetchSupervisores(pool);
  const vecino = await obtenerVecino(pool, supervisores);
  await pool.close();

  const salida = {
    generadoEl: f.ahora.toLocaleString("es-CL"),
    ultimoDia: vecino.ultimoDia,
    mesInicial: vecino.mesInicial,
    meta: vecino.meta,
    tipos: vecino.tipos,
    // Sin RUT ni ID: la pagina del supervisor solo recibe nombres.
    meses: vecino.meses.map((m) => ({ mes: m.mes, tecnicos: [...m.tecnicos.values()] })),
  };

  const plantilla = fs.readFileSync(path.join(__dirname, "plantilla-vecino.html"), "utf-8");
  // Formato visual compartido con supervisor.html y reiteradas.html.
  const estiloAcademia = fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8");
  const html = plantilla
    .replace("/*__ESTILO_ACADEMIA__*/", () => estiloAcademia)
    .replace("__DATA_VECINO_JSON__", () => JSON.stringify(salida).replace(/</g, "\\u003c"));

  // Controles antes de escribir: si algo no cuadra no se toca vecino.html
  // (Actualizar_Automatico.ps1 sigue publicando el resto del portal igual).
  const errores = [];
  if (salida.meses.length === 0 || salida.meses.every((m) => m.tecnicos.length === 0)) errores.push("0 tecnicos");
  if (/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/.test(html)) errores.push("contiene un RUT completo");
  if (!html.trimEnd().endsWith("</html>") || html.includes("__DATA_VECINO_JSON__") || html.includes("__ESTILO_ACADEMIA__")) errores.push("plantilla sin reemplazar o HTML cortado");
  if (errores.length) {
    console.error("VALIDACION VECINO FALLIDA: " + errores.join(" | "));
    process.exit(1);
  }

  // Se publica cifrado, detras del ingreso de supervisores.
  const destino = await publicarProtegida(html, "vecino.html", "vecino", "Consulta de estado vecino");

  console.log(`==> Generado: ${destino}`);
  for (const m of salida.meses) {
    const total = m.tecnicos.reduce((s, t) => s + t.total, 0);
    const con = m.tecnicos.reduce((s, t) => s + t.conConsulta, 0);
    console.log(`    ${m.mes}: ${m.tecnicos.length} tecnicos | ${con} de ${total} ordenes con consulta (${total ? ((con / total) * 100).toFixed(1) : "0.0"}%)`);
  }
  console.log(`    VECINO OK: mes inicial ${salida.mesInicial} | datos hasta ${salida.ultimoDia}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("ERROR:", err.message);
    process.exit(1);
  });
}

module.exports = { obtenerVecino };
