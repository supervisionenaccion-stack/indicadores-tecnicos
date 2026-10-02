// Reporte de Calidad: actividades reiteradas (reparaciones) dentro del mes en curso.
// Una actividad de Cobra cerrada en el mes queda "reiterada" si el mismo
// cliente tuvo una Reparacion posterior (Orden Repetido de CALIDAD_VTR)
// tambien dentro del mes. Solo lectura sobre la BD; no toca el portal.
// Uso: node reportes/generar_reiteradas.js  ->  reiteradas.html (se publica, boton en supervisor.html)
//                                             + reportes/Reiteradas_Calidad_AAAA-MM.html (historico local)
// Lo corre Actualizar_Automatico.ps1 todos los dias despues de generar_portal.js.

const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const { publicarProtegida } = require("./proteger.js");

const RAIZ = path.join(__dirname, "..");

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
loadEnvLocal();

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || "1433", 10),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 900000 },
};

// Mismas metas y criterios que generar_portal.js
const META_CALIDAD_POR_CIUDAD = { ARICA: 4.76, SANTIAGO: 5.62, "V REGION": 5.56 };
const META_CALIDAD_DEFAULT = 5.31;

function toSqlDate(d) {
  return d.toISOString().slice(0, 10);
}
function normalizeRut(rut) {
  return String(rut).trim().toUpperCase().replace(/\./g, "").replace(/-/g, "");
}
function idCatFromRut(rut) {
  let last6 = normalizeRut(rut).slice(-6);
  if (last6.endsWith("K")) last6 = last6.slice(0, -1) + "0";
  return last6;
}
function leerJson(nombre) {
  const p = path.join(RAIZ, nombre);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : [];
}

async function fetchSupervisores(pool) {
  const result = await pool.request().query(`SELECT RUT_TECNICO, AGENCIA, SUPERVISOR FROM SUPERVISORES_VTR`);
  const overrides = leerJson("Supervisor_Temporal.json").filter((o) => o.activo);
  const map = new Map();
  for (const row of result.recordset) {
    const override = overrides.find((o) => row.SUPERVISOR === o.supervisorOriginal);
    if (override) row.SUPERVISOR = override.supervisorTemporal;
    map.set(normalizeRut(row.RUT_TECNICO), row);
  }
  return map;
}

// Se trae desde 31 dias antes del mes para que la eleccion del "repetido mas
// cercano" compita con las mismas filas que ve el portal.
async function fetchCalidad(pool, desdeStr, hastaStr) {
  const result = await pool
    .request()
    .input("desde", sql.Date, desdeStr)
    .input("hasta", sql.Date, hastaStr).query(`
    SELECT [Orden de Trabajo], [Numero Cliente], Ciudad, Fecha_Cierre, Rut_Tecnico, NOMBRE_TECNICO,
           TipoActividadPrimerServicio, SubtipoPrimerServicio,
           [Orden Repetido], Fecha_Creacion_Repetido, Fecha_Cierre_Repetido, Empresa_Repetido,
           Nombre_Tecnico_Repetido, TipoActividadRepetido, CodigoCierreRepetido, DiasDiferencia, EsRepetido30Dias
    FROM CALIDAD_VTR
    WHERE Fecha_Cierre >= @desde AND Fecha_Cierre < @hasta
  `);
  return result.recordset;
}

// Misma logica que buildRepetidoPorPrimerOrden de generar_portal.js
function buildRepetidoPorPrimerOrden(repRows) {
  const diff = (a, b) => (!a || !b ? Infinity : Math.abs(new Date(a) - new Date(b)));
  const pickClosest = (rows) => rows.reduce((best, r) => (diff(r.Fecha_Cierre, r.Fecha_Cierre_Repetido) < diff(best.Fecha_Cierre, best.Fecha_Cierre_Repetido) ? r : best));
  const agrupar = (rows, key) => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r[key])) m.set(r[key], []);
      m.get(r[key]).push(r);
    }
    return m;
  };
  const rn1 = [...agrupar(repRows, "Orden Repetido").values()].map(pickClosest);
  const resultado = new Map();
  for (const [orden, rows] of agrupar(rn1, "Orden de Trabajo")) resultado.set(orden, pickClosest(rows));
  return resultado;
}

async function main() {
  // Fecha local de este equipo como medianoche UTC (igual que hoyLocal() en
  // generar_portal.js): de noche en Chile ya es el dia siguiente en UTC.
  const ahora = new Date();
  let now = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
  // PORTAL_HOY=AAAA-MM-DD simula otra fecha, solo para probar cambios de mes.
  if (/^\d{4}-\d{2}-\d{2}$/.test(process.env.PORTAL_HOY || "")) now = new Date(process.env.PORTAL_HOY + "T00:00:00.000Z");
  // El dia 1 se muestra el cierre del mes anterior, igual que el portal.
  if (now.getUTCDate() === 1) now = new Date(now.getTime() - 86400000);
  const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const inicioMesStr = toSqlDate(inicioMes);
  const desdeStr = toSqlDate(new Date(inicioMes.getTime() - 31 * 86400000));
  const hastaStr = toSqlDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)));
  const mesClave = inicioMesStr.slice(0, 7);

  console.log(`==> Conectando... (CALIDAD_VTR desde ${desdeStr}, mes ${inicioMesStr} a ${hastaStr})`);
  const pool = await new sql.ConnectionPool(config).connect();
  const [supervisores, filas] = await Promise.all([fetchSupervisores(pool), fetchCalidad(pool, desdeStr, hastaStr)]);
  await pool.close();
  console.log(`==> Filas: ${filas.length} | Supervisores: ${supervisores.size}`);

  const repetidoPorOrden = buildRepetidoPorPrimerOrden(filas.filter((r) => r["Orden Repetido"]));
  const rutsBaja = new Set(leerJson("Tecnicos_Baja_NO_SUBIR.json").map((t) => normalizeRut(t.rut)));

  const vistos = new Set();
  const tecnicos = new Map(); // idCat -> resumen
  const detalle = [];
  let ultimoCierre = null;

  for (const row of filas) {
    if (!row.Fecha_Cierre || new Date(row.Fecha_Cierre) < inicioMes) continue;
    const rut = normalizeRut(row.Rut_Tecnico);
    if (rutsBaja.has(rut)) continue;
    const orden = row["Orden de Trabajo"];
    const key = orden + "||" + rut;
    if (vistos.has(key)) continue;
    vistos.add(key);

    const cierre = new Date(row.Fecha_Cierre);
    if (!ultimoCierre || cierre > ultimoCierre) ultimoCierre = cierre;

    const sup = supervisores.get(rut);
    const id = idCatFromRut(row.Rut_Tecnico);
    if (!tecnicos.has(id)) {
      const agencia = sup?.AGENCIA ?? null;
      tecnicos.set(id, {
        id,
        nombre: row.NOMBRE_TECNICO,
        supervisor: sup?.SUPERVISOR ?? "Sin supervisor",
        agencia: agencia ?? "Sin agencia",
        meta: agencia && META_CALIDAD_POR_CIUDAD[agencia] != null ? META_CALIDAD_POR_CIUDAD[agencia] : META_CALIDAD_DEFAULT,
        ordenes: 0,
        reiteradas: 0,
      });
    }
    const t = tecnicos.get(id);
    t.ordenes += 1;

    const m = repetidoPorOrden.get(orden);
    const fechaRep = m && (m.Fecha_Creacion_Repetido || m.Fecha_Cierre_Repetido);
    const reiteradaEnMes = m && m.EsRepetido30Dias && fechaRep && new Date(fechaRep) >= inicioMes;
    if (!reiteradaEnMes) continue;
    t.reiteradas += 1;
    detalle.push({
      id,
      tecnico: row.NOMBRE_TECNICO,
      supervisor: t.supervisor,
      agencia: t.agencia,
      ciudad: row.Ciudad,
      orden,
      cliente: row["Numero Cliente"],
      actividad: row.TipoActividadPrimerServicio,
      subtipo: row.SubtipoPrimerServicio,
      cierre: row.Fecha_Cierre,
      ordenRep: m["Orden Repetido"],
      cierreRep: m.Fecha_Cierre_Repetido,
      actividadRep: m.TipoActividadRepetido,
      empresaRep: m.Empresa_Repetido,
      tecnicoRep: m.Nombre_Tecnico_Repetido,
      causa: m.CodigoCierreRepetido || "Sin causa registrada",
      dias:
        m.DiasDiferencia ??
        (m.Fecha_Cierre_Repetido ? Math.round((new Date(m.Fecha_Cierre_Repetido) - cierre) / 86400000) : null),
    });
  }

  const data = {
    mes: mesClave,
    desde: inicioMesStr,
    hasta: ultimoCierre ? toSqlDate(ultimoCierre) : inicioMesStr,
    generado: now.toLocaleString("es-CL", { timeZone: "America/Santiago" }),
    tecnicos: [...tecnicos.values()],
    detalle: detalle.sort((a, b) => new Date(b.cierreRep || 0) - new Date(a.cierreRep || 0)),
  };

  const plantilla = fs.readFileSync(path.join(__dirname, "plantilla-reiteradas.html"), "utf-8");
  // Logo e icono incrustados (data URI) para que el HTML funcione solo, fuera de la carpeta del portal
  const dataUri = (archivo) => "data:image/png;base64," + fs.readFileSync(path.join(RAIZ, archivo)).toString("base64");
  // Formato visual compartido con supervisor.html y vecino.html.
  const estiloAcademia = fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8");
  const html = plantilla
    .replace("/*__ESTILO_ACADEMIA__*/", () => estiloAcademia)
    .replace("__LOGO_DATAURI__", () => dataUri("logo-cobra.png"))
    .replace("__ICON_DATAURI__", () => dataUri("icon-192.png"))
    .replace("/*__DATA__*/null", () => JSON.stringify(data).replace(/</g, "\\u003c"));
  // Controles antes de escribir: si algo no cuadra no se toca reiteradas.html
  // (Actualizar_Automatico.ps1 sigue publicando el resto del portal igual).
  const errores = [];
  if (data.tecnicos.length === 0) errores.push("0 tecnicos");
  if (!data.hasta.startsWith(mesClave)) errores.push(`el ultimo cierre (${data.hasta}) no es del mes ${mesClave}`);
  if (/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/.test(html)) errores.push("contiene un RUT completo");
  if (!html.trimEnd().endsWith("</html>") || /__\w+_DATAURI__|\/\*__DATA__\*\/|__ESTILO_ACADEMIA__/.test(html)) errores.push("plantilla sin reemplazar o HTML cortado");
  if (errores.length) {
    console.error("VALIDACION REITERADAS FALLIDA: " + errores.join(" | "));
    process.exit(1);
  }

  // reiteradas.html (raiz) es el que se publica y enlaza supervisor.html; va
  // cifrado, detras del ingreso de supervisores. La copia en reportes/ queda
  // solo como historico local de cada mes (sin cifrar, no se sube).
  const historicoPath = path.join(__dirname, `Reiteradas_Calidad_${mesClave}.html`);
  const publicadoPath = await publicarProtegida(html, "reiteradas.html", "reiteradas", "Reiterados dentro del mes");
  fs.writeFileSync(historicoPath, html, "utf-8");

  const totalOrd = data.tecnicos.reduce((s, t) => s + t.ordenes, 0);
  console.log(
    `==> Generado: ${publicadoPath} (+ historico ${path.basename(historicoPath)})\n    REITERADAS OK: ${data.tecnicos.length} tecnicos | ${totalOrd} actividades | ${detalle.length} reiteradas (${totalOrd ? ((detalle.length / totalOrd) * 100).toFixed(2) : 0}%) | ${data.desde} a ${data.hasta}`
  );
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
