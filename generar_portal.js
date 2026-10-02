// Genera el Portal de Tecnicos Claro/VTR (solo local, sin publicar) con el
// avance del mes en curso (Derivaciones/RGU) y el mes anterior completo
// (Calidad), desde la base de datos Sistemas_local.
// Uso: doble clic en "Actualizar_Dashboard.bat", o `node generar_portal.js`.

const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const ExcelJS = require("exceljs");
const { obtenerVecino } = require("./reportes/generar_vecino.js");
const { publicarProtegida, sincronizarTecnicos, leerEnv } = require("./reportes/proteger.js");

// ---------- 0. Cargar variables desde .env.local (sin dependencias extra) ----------
function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
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

// ---------- 1. Rangos de fecha: mes a la fecha (avance del mes) ----------
// El tecnico necesita ver como van sus indicadores a medida que avanza el
// mes (no solo el dato de un dia aislado), y que al cerrar el mes el numero
// coincida con un reporte mensual tipo Excel. Por eso:
//  - Derivaciones/RGU (MATRIZ_VTR): mes en curso, desde el dia 1 hasta el
//    ultimo dia con carga completa (para no incluir un dia a medio cargar).
//  - Calidad (CALIDAD_VTR): el mes calendario anterior completo, tal como
//    ya se valido con el usuario ("Calidad Agosto" se mide con cierres de
//    julio, porque el indicador de repetido a 30 dias necesita ese tiempo
//    para madurar). Al ya estar cerrado, no hace falta detectar dias
//    parciales.
// Ademas de esos rangos "para las tarjetas del mes", tanto Calidad como RGU
// se vuelven a consultar por separado desde el 1 de enero hasta hoy, solo
// para los graficos de evolucion mes a mes (mismo patron para ambos).
// "Hoy" segun el reloj de este equipo, expresado como medianoche UTC de esa
// fecha, para que el resto del codigo (que trabaja las fechas en UTC) vea el
// dia y el mes locales. Con new Date() directo, una corrida despues de las
// 20:00-21:00 hora de Chile ya caia en el dia siguiente en UTC, y el ultimo
// dia del mes tomaba el mes siguiente como "mes en curso".
// PORTAL_HOY=AAAA-MM-DD simula otra fecha, solo para probar cambios de mes.
function hoyLocal() {
  if (/^\d{4}-\d{2}-\d{2}$/.test(process.env.PORTAL_HOY || "")) return new Date(process.env.PORTAL_HOY + "T00:00:00.000Z");
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// El dia 1 de cada mes el portal muestra como CERRO el mes anterior (el
// tecnico alcanza a ver su resultado final, con el ultimo dia incluido), y
// recien el dia 2 parte con los datos del mes nuevo. Para eso, el dia 1 todos
// los periodos se calculan como si fuera el ultimo dia del mes anterior.
function esDiaDeCierre() {
  return hoyLocal().getUTCDate() === 1;
}
function fechaReferencia() {
  const hoy = hoyLocal();
  return esDiaDeCierre() ? new Date(hoy.getTime() - 24 * 60 * 60 * 1000) : hoy;
}
function toSqlDate(d) {
  return d.toISOString().slice(0, 10);
}
function dateLabel(d) {
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
function monthLabel(d) {
  return d.toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
}

function previousMonthRange(now = fechaReferencia()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: toSqlDate(start), end: toSqlDate(end), label: monthLabel(start) };
}

// Elige el ultimo dia con volumen "normal" de datos dentro del mes en curso,
// descartando dias recientes que aun esten a medio cargar (ej: el dia de hoy
// solo tiene una fraccion de las filas esperadas). Compara contra la mediana
// de los dias previos en vez de un umbral fijo, para no depender de un
// numero de filas hardcodeado que puede dejar de ser valido si cambia el
// volumen de datos.
function pickLastCompleteDay(rows, monthStartStr) {
  const sorted = [...rows]
    .map((r) => ({ dia: toSqlDate(new Date(r.dia)), cnt: r.cnt }))
    .sort((a, b) => (a.dia < b.dia ? 1 : -1)); // desc
  if (sorted.length === 0) return monthStartStr;

  const referencia = sorted
    .slice(1, 6)
    .map((r) => r.cnt)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const mediana = referencia.length ? referencia[Math.floor(referencia.length / 2)] : 0;
  const umbral = mediana * 0.5;

  for (const r of sorted) {
    if (r.cnt > 0 && r.cnt >= umbral) return r.dia < monthStartStr ? monthStartStr : r.dia;
  }
  return sorted[0].dia < monthStartStr ? monthStartStr : sorted[0].dia;
}

async function monthToDateRangeMatriz(pool, now = fechaReferencia()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1));
  const monthStartStr = toSqlDate(monthStart);
  const nextMonthStartStr = toSqlDate(new Date(Date.UTC(y, m + 1, 1)));

  const result = await pool.request().query(`
    SELECT CAST(Fecha AS DATE) AS dia, COUNT(*) AS cnt
    FROM MATRIZ_VTR
    WHERE Fecha >= DATEADD(DAY, -12, CAST(GETDATE() AS DATE))
    GROUP BY CAST(Fecha AS DATE)
  `);
  // En dia de cierre ya existen filas del mes nuevo: no cuentan para el mes que se muestra.
  const delMes = result.recordset.filter((r) => toSqlDate(new Date(r.dia)) < nextMonthStartStr);
  const lastCompleteDay = pickLastCompleteDay(delMes, monthStartStr);
  const endExclusive = toSqlDate(new Date(new Date(lastCompleteDay + "T00:00:00.000Z").getTime() + 24 * 60 * 60 * 1000));
  const label = `1 al ${new Date(lastCompleteDay + "T00:00:00.000Z").getUTCDate()} de ${monthLabel(monthStart)}`;
  return { start: monthStartStr, end: endExclusive, label };
}

// ---------- 2. Consultas: SOLO extraccion, sin CTE/JOIN/GROUP BY en el servidor ----------
// Todo el cruce, la deduplicacion de "repetidos" y las agregaciones se hacen
// en JS mas abajo, para no cargar al servidor con consultas analiticas
// pesadas (window functions, self-joins) sobre tablas de mas de un millon
// de filas.

// Reasignaciones temporales de supervisor (ej. un supervisor en otras
// actividades por un tiempo y otro cubre a su equipo mientras tanto). Vive
// en Supervisor_Temporal.json, sin RUT ni datos sensibles, para que sea
// facil de prender/apagar cuando la situacion vuelva a la normalidad: solo
// hay que poner "activo": false (o borrar la entrada), sin tocar codigo.
function loadSupervisorOverrides() {
  const overridesPath = path.join(__dirname, "Supervisor_Temporal.json");
  if (!fs.existsSync(overridesPath)) return [];
  const lista = JSON.parse(fs.readFileSync(overridesPath, "utf-8"));
  return lista.filter((o) => o.activo);
}

async function fetchSupervisores(pool) {
  const result = await pool.request().query(`
    SELECT RUT_TECNICO, TECNICO, AGENCIA, SUPERVISOR FROM SUPERVISORES_VTR
  `);
  const overrides = loadSupervisorOverrides();
  const map = new Map();
  let reasignados = 0;
  for (const row of result.recordset) {
    const override = overrides.find((o) => row.SUPERVISOR === o.supervisorOriginal);
    if (override) {
      row.SUPERVISOR = override.supervisorTemporal;
      reasignados++;
    }
    map.set(normalizeRut(row.RUT_TECNICO), row);
  }
  if (reasignados > 0) {
    console.log(`==> Supervisor temporal aplicado: ${reasignados} tecnico(s) reasignado(s).`);
  }
  return map;
}

// Filas base del mes objetivo (simple filtro por fecha, sin join ni CTE).
async function fetchCalidadBase(pool, startStr, endStr) {
  const result = await pool
    .request()
    .input("start", sql.Date, startStr)
    .input("end", sql.Date, endStr).query(`
    SELECT [Orden de Trabajo], Rut_Tecnico, NOMBRE_TECNICO, Empresa, Fecha_Cierre, TipoActividadPrimerServicio
    FROM CALIDAD_VTR
    WHERE Fecha_Cierre >= @start AND Fecha_Cierre < @end
  `);
  return result.recordset;
}

// Filas con vinculo a un "repetido" (en toda la tabla, sin filtro de fecha:
// el repetido puede haberse cerrado en cualquier momento). Simple filtro por
// columna no nula, sin CTE ni window functions.
async function fetchCalidadRepetidos(pool) {
  const result = await pool.request().query(`
    SELECT
        [Orden Repetido],
        [Orden de Trabajo] AS PrimerOrden,
        EsRepetido30Dias,
        Fecha_Cierre AS FechaPrimerCierre,
        Fecha_Cierre_Repetido AS FechaRepetido,
        CodigoCierreRepetido
    FROM CALIDAD_VTR
    WHERE [Orden Repetido] IS NOT NULL
  `);
  return result.recordset;
}

// Filas base de MATRIZ_VTR para Derivaciones (Alta/Migracion), sin join ni GROUP BY.
async function fetchDerivacionesBase(pool, startStr, endStr) {
  const result = await pool
    .request()
    .input("start", sql.Date, startStr)
    .input("end", sql.Date, endStr).query(`
    SELECT [Rut o Bucket] AS Rut_Tecnico, Estado
    FROM MATRIZ_VTR
    WHERE Fecha >= @start AND Fecha < @end
      AND (Tecnico LIKE '%cobr%' OR Tecnico LIKE '%cbr%')
      AND [Orden de Trabajo] IS NOT NULL
      AND ([Tipo de Actividad] = 'Alta' OR [Tipo de Actividad] LIKE 'Migra%')
  `);
  return result.recordset;
}

// Filas base de MATRIZ_VTR para RGU (todas las actividades), sin join ni GROUP BY.
// No se filtra por Orden de Trabajo: el Excel suma RGU completada aunque la
// fila no tenga orden; calcularRgu() distingue ambos casos.
async function fetchRguBase(pool, startStr, endStr) {
  const result = await pool
    .request()
    .input("start", sql.Date, startStr)
    .input("end", sql.Date, endStr).query(`
    SELECT [Rut o Bucket] AS Rut_Tecnico, Estado, RGU, [Area derivacion], [Orden de Trabajo], Fecha
    FROM MATRIZ_VTR
    WHERE Fecha >= @start AND Fecha < @end
      AND (Tecnico LIKE '%cobr%' OR Tecnico LIKE '%cbr%')
  `);
  return result.recordset;
}

// ---------- 2b. Calculo local (replica en JS la logica de las consultas originales) ----------

// Replica RepetidoMasCercano + RN1 + PrimerOrdenUnico + RN2: para cada
// PrimerOrden, se queda con el registro "repetido" cuyo cierre esta mas
// cerca en el tiempo del cierre original (deduplicando cuando hay varias
// filas candidatas para el mismo Orden Repetido o el mismo PrimerOrden).
function buildRepetidoPorPrimerOrden(repRows) {
  function diffSeconds(a, b) {
    if (!a || !b) return Infinity;
    return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 1000);
  }
  function pickClosest(rows) {
    let best = null;
    let bestDiff = Infinity;
    for (const r of rows) {
      const d = diffSeconds(r.FechaPrimerCierre, r.FechaRepetido);
      if (d < bestDiff) {
        bestDiff = d;
        best = r;
      }
    }
    return best;
  }

  // RN1: un ganador por cada [Orden Repetido]
  const porOrdenRepetido = new Map();
  for (const r of repRows) {
    const key = r["Orden Repetido"];
    if (!porOrdenRepetido.has(key)) porOrdenRepetido.set(key, []);
    porOrdenRepetido.get(key).push(r);
  }
  const ganadoresRN1 = [];
  for (const rows of porOrdenRepetido.values()) {
    ganadoresRN1.push(pickClosest(rows));
  }

  // RN2: un ganador por cada PrimerOrden (puede haber varios Orden Repetido
  // distintos apuntando al mismo PrimerOrden)
  const porPrimerOrden = new Map();
  for (const r of ganadoresRN1) {
    const key = r.PrimerOrden;
    if (!porPrimerOrden.has(key)) porPrimerOrden.set(key, []);
    porPrimerOrden.get(key).push(r);
  }
  const resultado = new Map();
  for (const [primerOrden, rows] of porPrimerOrden.entries()) {
    resultado.set(primerOrden, pickClosest(rows));
  }
  return resultado;
}

function calcularCalidad(baseRows, repRows, supervisores) {
  const repetidoPorPrimerOrden = buildRepetidoPorPrimerOrden(repRows);

  // SELECT DISTINCT sobre (Orden de Trabajo, Rut_Tecnico, NOMBRE_TECNICO,
  // Empresa, EsRepetido30Dias, SUPERVISOR)
  const vistos = new Set();
  const porTecnico = new Map();
  const porDia = new Map(); // fecha (yyyy-mm-dd) -> { total, rep, porSupervisor: Map }

  function bucketDia(fecha) {
    if (!porDia.has(fecha)) {
      porDia.set(fecha, { total: 0, rep: 0, porSupervisor: new Map(), porTecnico: new Map() });
    }
    return porDia.get(fecha);
  }
  function sumarGrupo(mapa, clave, esRepetido) {
    if (!clave) return;
    if (!mapa.has(clave)) mapa.set(clave, { total: 0, rep: 0 });
    const g = mapa.get(clave);
    g.total += 1;
    g.rep += esRepetido;
  }

  for (const row of baseRows) {
    const match = repetidoPorPrimerOrden.get(row["Orden de Trabajo"]);
    const esRepetido = match && match.EsRepetido30Dias ? 1 : 0;
    const rut = normalizeRut(row.Rut_Tecnico);
    const sup = supervisores.get(rut);
    const supervisor = sup?.SUPERVISOR ?? null;
    const agencia = sup?.AGENCIA ?? null;

    const dedupeKey = [row["Orden de Trabajo"], rut, row.NOMBRE_TECNICO, row.Empresa, esRepetido, supervisor].join(
      "||"
    );
    if (vistos.has(dedupeKey)) continue;
    vistos.add(dedupeKey);

    if (!porTecnico.has(rut)) {
      porTecnico.set(rut, {
        rut: row.Rut_Tecnico,
        nombre: row.NOMBRE_TECNICO,
        supervisor,
        agencia,
        totalOrdenes: 0,
        repetidos30Dias: 0,
        eventosRepetidos: [],
      });
    }
    const t = porTecnico.get(rut);
    t.totalOrdenes += 1;
    t.repetidos30Dias += esRepetido;
    if (!t.supervisor && supervisor) t.supervisor = supervisor;
    if (!t.agencia && agencia) t.agencia = agencia;
    if (esRepetido) {
      const dias =
        match.FechaPrimerCierre && match.FechaRepetido
          ? Math.round(Math.abs(new Date(match.FechaRepetido).getTime() - new Date(match.FechaPrimerCierre).getTime()) / 86400000)
          : null;
      t.eventosRepetidos.push({
        causa: match.CodigoCierreRepetido || "Sin causa registrada",
        dias,
        tipoActividad: row.TipoActividadPrimerServicio || null,
        ordenTrabajo: row["Orden de Trabajo"] || null,
        fecha: row.Fecha_Cierre ? toSqlDate(new Date(row.Fecha_Cierre)) : null,
      });
    }

    const fecha = toSqlDate(new Date(row.Fecha_Cierre));
    const dia = bucketDia(fecha);
    dia.total += 1;
    dia.rep += esRepetido;
    sumarGrupo(dia.porSupervisor, supervisor, esRepetido);
    sumarGrupo(dia.porTecnico, rut, esRepetido);
  }
  return { porTecnico: [...porTecnico.values()], porDia };
}

// Serie mensual (no acumulada entre meses: cada mes muestra SU PROPIO %,
// no un acumulado corriendo) de % repetidos, desde enero del anio en curso
// hasta el mes en curso inclusive (igual criterio que RGU: se muestra el
// avance del mes actual, aunque su % todavia pueda subir mas adelante a
// medida que aparecen mas repetidos de sus ordenes mas recientes).
function construirEvolutivoMensual(porDia) {
  const porMes = new Map(); // "yyyy-mm" -> { total, rep, porSupervisor: Map, porTecnico: Map }

  for (const [fecha, dia] of porDia.entries()) {
    const mes = fecha.slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, { total: 0, rep: 0, porSupervisor: new Map(), porTecnico: new Map() });
    const m = porMes.get(mes);
    m.total += dia.total;
    m.rep += dia.rep;
    for (const [sup, g] of dia.porSupervisor.entries()) {
      if (!m.porSupervisor.has(sup)) m.porSupervisor.set(sup, { total: 0, rep: 0 });
      const ms = m.porSupervisor.get(sup);
      ms.total += g.total;
      ms.rep += g.rep;
    }
    for (const [rut, g] of dia.porTecnico.entries()) {
      if (!m.porTecnico.has(rut)) m.porTecnico.set(rut, { total: 0, rep: 0 });
      const mt = m.porTecnico.get(rut);
      mt.total += g.total;
      mt.rep += g.rep;
    }
  }

  const meses = [...porMes.keys()].sort();
  const pct = (g) => (g && g.total ? Math.round((g.rep / g.total) * 1000) / 10 : null);

  const supervisoresUnicos = new Set();
  const tecnicosUnicos = new Set();
  for (const m of porMes.values()) {
    for (const k of m.porSupervisor.keys()) supervisoresUnicos.add(k);
    for (const k of m.porTecnico.keys()) tecnicosUnicos.add(k);
  }
  const porSupervisor = {};
  for (const nombre of supervisoresUnicos) {
    porSupervisor[nombre] = meses.map((mes) => pct(porMes.get(mes).porSupervisor.get(nombre)));
  }
  const porTecnico = {};
  for (const rut of tecnicosUnicos) {
    porTecnico[rut] = meses.map((mes) => pct(porMes.get(mes).porTecnico.get(rut)));
  }

  return {
    meses,
    todos: meses.map((mes) => pct(porMes.get(mes))),
    porSupervisor,
    porTecnico,
  };
}

// Meta de calidad (maximo % de repetidos aceptado) por ciudad. Segun tabla
// de Produccion VTR-Claro compartida por el usuario.
const META_CALIDAD_POR_CIUDAD = {
  ARICA: 4.76,
  SANTIAGO: 5.62,
  "V REGION": 5.56,
};
const META_CALIDAD_DEFAULT = 5.31; // promedio general de la tabla, para agencias no listadas

function metaCalidadPorAgencia(agencia) {
  if (agencia && META_CALIDAD_POR_CIUDAD[agencia] != null) return META_CALIDAD_POR_CIUDAD[agencia];
  return META_CALIDAD_DEFAULT;
}

// Meta de produccion RGU por dia, por ciudad. Solo Arica difiere (4.3 vs 4).
const META_RGU_DIARIA_POR_CIUDAD = {
  ARICA: 4.3,
  SANTIAGO: 4,
  "V REGION": 4,
};
const META_RGU_DIARIA_DEFAULT = 4;

function metaRguDiariaPorAgencia(agencia) {
  if (agencia && META_RGU_DIARIA_POR_CIUDAD[agencia] != null) return META_RGU_DIARIA_POR_CIUDAD[agencia];
  return META_RGU_DIARIA_DEFAULT;
}

function calcularDerivaciones(baseRows, supervisores) {
  const porTecnico = new Map();
  for (const row of baseRows) {
    const rut = normalizeRut(row.Rut_Tecnico);
    const sup = supervisores.get(rut);
    if (!porTecnico.has(rut)) {
      porTecnico.set(rut, {
        rut: row.Rut_Tecnico,
        tecnico: sup?.TECNICO ?? null,
        supervisor: sup?.SUPERVISOR ?? null,
        agencia: sup?.AGENCIA ?? null,
        qOrdenes: 0,
        qDerivaciones: 0,
      });
    }
    const t = porTecnico.get(rut);
    if (row.Estado === "Completado" || row.Estado === "No Realizada") t.qOrdenes += 1;
    if (row.Estado === "No Realizada") t.qDerivaciones += 1;
  }
  return [...porTecnico.values()];
}

// Replica el calculo del Excel de produccion (con el que se paga), consultas
// "Q actividades" + "FTTH-NFTT". Si el Excel cambia de criterio, hay que
// cambiarlo aca tambien:
//  - Solo tecnicos que estan en SUPERVISORES_VTR.
//  - Dia trabajado (Q_TECNICO): dia en que el tecnico tuvo al menos una
//    actividad con Orden de Trabajo, aunque no haya completado ninguna (un
//    dia con ordenes y sin produccion igual cuenta en el divisor).
//  - RGU completada (RGU_Completadas): suma de RGU > 0 de las actividades
//    Completado, o No Realizada con derivacion GSA, de los dias trabajados.
//    Igual que en el Excel, aca NO se exige Orden de Trabajo.
//  - Productividad = RGU completada / dias trabajados; cumplimiento =
//    productividad / meta diaria de la ciudad. Se expresa como meta del
//    periodo = meta diaria x dias trabajados (no dias calendario del mes).
function calcularRgu(baseRows, supervisores) {
  const porTecnico = new Map();
  const diasPorTecnico = new Map(); // rut -> Map(fecha -> { conOrden, rguCompletada })

  for (const row of baseRows) {
    const rut = normalizeRut(row.Rut_Tecnico);
    const sup = supervisores.get(rut);
    if (!sup) continue;
    if (!porTecnico.has(rut)) {
      porTecnico.set(rut, {
        rut: row.Rut_Tecnico,
        tecnico: sup.TECNICO ?? null,
        supervisor: sup.SUPERVISOR ?? null,
        agencia: sup.AGENCIA ?? null,
        rguTotal: 0,
        rguCompletadaGsa: 0,
      });
      diasPorTecnico.set(rut, new Map());
    }
    const t = porTecnico.get(rut);
    const dias = diasPorTecnico.get(rut);
    const fecha = toSqlDate(new Date(row.Fecha));
    if (!dias.has(fecha)) dias.set(fecha, { conOrden: false, rguCompletada: 0 });
    const dia = dias.get(fecha);

    const rgu = row.RGU || 0;
    const completadaGsa =
      row.Estado === "Completado" || (row["Area derivacion"] === "GSA" && row.Estado === "No Realizada");
    if (completadaGsa && rgu > 0) dia.rguCompletada += rgu;
    if (row["Orden de Trabajo"] != null) {
      dia.conOrden = true;
      t.rguTotal += rgu;
    }
  }

  const resultado = [];
  for (const [rut, t] of porTecnico.entries()) {
    let diasTrabajados = 0;
    for (const dia of diasPorTecnico.get(rut).values()) {
      if (!dia.conOrden) continue;
      diasTrabajados += 1;
      t.rguCompletadaGsa += dia.rguCompletada;
    }
    if (diasTrabajados === 0) continue;
    const metaDiaria = metaRguDiariaPorAgencia(t.agencia);
    const metaPeriodo = metaDiaria * diasTrabajados;
    resultado.push({
      ...t,
      diasTrabajados,
      metaDiaria,
      metaPeriodo,
      pctCumplimiento: metaPeriodo ? (t.rguCompletadaGsa / metaPeriodo) * 100 : 0,
    });
  }
  return resultado;
}

// Serie mensual (no acumulada entre meses) de % de cumplimiento RGU, desde
// enero del anio en curso hasta el ultimo mes con datos. Reutiliza
// calcularRgu() por separado sobre las filas de cada mes (asi "dias trabajados"
// y la meta del periodo se calculan por mes, igual que se calcularian por
// mes en un reporte cerrado). El % del equipo es el promedio simple del %
// de cumplimiento de sus tecnicos (todos pesan igual, sin importar cuantos
// dias trabajaron), igual que "% Cump. Prod" en la hoja Resumen del Excel
// de produccion -- no RGU total del equipo / meta total.
function construirEvolutivoMensualRgu(baseRows, supervisores) {
  const porMes = new Map(); // "yyyy-mm" -> filas de ese mes
  for (const row of baseRows) {
    const mes = toSqlDate(new Date(row.Fecha)).slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push(row);
  }

  const meses = [...porMes.keys()].sort();
  const supervisoresUnicos = new Set();
  const porMesAgregado = meses.map((mes) => {
    const tecnicosDelMes = calcularRgu(porMes.get(mes), supervisores);
    const nuevoGrupo = () => ({ suma: 0, n: 0, cumplen: 0, rgu: 0, dias: 0 });
    const sumar = (g, t) => {
      g.suma += t.pctCumplimiento;
      g.n += 1;
      if (t.pctCumplimiento >= 100) g.cumplen += 1;
      g.rgu += t.rguCompletadaGsa;
      g.dias += t.diasTrabajados;
    };
    const todos = nuevoGrupo();
    const porSupervisor = new Map(); // nombre -> grupo
    for (const t of tecnicosDelMes) {
      sumar(todos, t);
      if (t.supervisor) {
        supervisoresUnicos.add(t.supervisor);
        if (!porSupervisor.has(t.supervisor)) porSupervisor.set(t.supervisor, nuevoGrupo());
        sumar(porSupervisor.get(t.supervisor), t);
      }
    }
    return { todos, porSupervisor };
  });

  const promedio = (g) => (g && g.n ? Math.round((g.suma / g.n) * 10) / 10 : null);
  // Lo que explica cada punto al pasar el cursor sobre su porcentaje.
  const detalle = (g) =>
    g && g.n ? { tecnicos: g.n, cumplen: g.cumplen, rgu: Math.round(g.rgu * 100) / 100, dias: g.dias } : null;

  const porSupervisor = {};
  const detallePorSupervisor = {};
  for (const nombre of supervisoresUnicos) {
    porSupervisor[nombre] = porMesAgregado.map((m) => promedio(m.porSupervisor.get(nombre)));
    detallePorSupervisor[nombre] = porMesAgregado.map((m) => detalle(m.porSupervisor.get(nombre)));
  }

  return {
    meses,
    todos: porMesAgregado.map((m) => promedio(m.todos)),
    porSupervisor,
    detalle: { todos: porMesAgregado.map((m) => detalle(m.todos)), porSupervisor: detallePorSupervisor },
  };
}

// ---------- 2c. Tecnicos de baja: exclusion manual (SUPERVISORES_VTR no tiene columna de estado) ----------
// La BD no distingue tecnicos activos de los que ya no trabajan -- la tabla
// simplemente sigue listando a todos los que alguna vez tuvieron datos. Por
// eso se mantiene una lista local aparte (con RUT completo, nunca se sube a
// git) para excluirlos del portal en cada corrida.
function loadRutsBaja() {
  const bajaPath = path.join(__dirname, "Tecnicos_Baja_NO_SUBIR.json");
  if (!fs.existsSync(bajaPath)) return new Set();
  const lista = JSON.parse(fs.readFileSync(bajaPath, "utf-8"));
  return new Set(lista.map((t) => normalizeRut(t.rut)));
}

// ---------- 3. idCAT a partir del RUT (no se publica el RUT completo) ----------
function normalizeRut(rut) {
  return String(rut).trim().toUpperCase().replace(/\./g, "").replace(/-/g, "");
}
// Identificador estable por tecnico: ultimos 6 caracteres del RUT (K -> 0).
// Al derivarse directamente del RUT, se mantiene igual mientras el tecnico
// no cambie de RUT, y aparece automaticamente la primera vez que ese RUT
// se ve en los datos -- no requiere un registro persistente aparte.
function idCatFromRut(rut) {
  const norm = normalizeRut(rut);
  let last6 = norm.slice(-6);
  if (last6.endsWith("K")) last6 = last6.slice(0, -1) + "0";
  return last6;
}
function capitalize(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
function usuarioFromNombre(nombreCompleto) {
  const tokens = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "Tecnico";
  const nombre = tokens[0];
  let apellido;
  if (tokens.length >= 4) apellido = tokens[2];
  else if (tokens.length === 3) apellido = tokens[1];
  else apellido = tokens[tokens.length - 1];
  return `${capitalize(nombre)} ${capitalize(apellido)}`;
}

// JSON listo para incrustar dentro de <script>: se escapa "<" para que un
// dato con "</script>" no corte la pagina. Se inserta con replace(..., () => ...)
// para que un "$&" o "$'" dentro de los datos no se interprete como patron.
function jsonParaScript(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

// Calidad (% repetidos) del mes anterior a inicioSerieStr, total y por
// supervisor, con el mismo calculo de la serie mensual. Devuelve
// { mes, todos, porSupervisor } o null si no se pudo obtener (el grafico
// combinado simplemente parte un mes despues).
async function obtenerCalidadMesPrevio(pool, inicioSerieStr, calidadRep, supervisores) {
  const cachePath = path.join(__dirname, "reportes", "calidad_mes_previo.json");
  const inicio = new Date(inicioSerieStr + "T00:00:00.000Z");
  const desde = toSqlDate(new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() - 1, 1)));
  const clave = desde.slice(0, 7);
  try {
    const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf-8")) : {};
    if (cache[clave]) return cache[clave];

    console.log(`==> Calculando la Calidad de ${clave} (una sola vez; puede tardar varios minutos)...`);
    const base = await fetchCalidadBase(pool, desde, inicioSerieStr);
    const ev = construirEvolutivoMensual(calcularCalidad(base, calidadRep, supervisores).porDia);
    const i = ev.meses.indexOf(clave);
    if (i === -1) return null;
    const porSupervisor = {};
    for (const [nombre, valores] of Object.entries(ev.porSupervisor)) {
      if (valores[i] != null) porSupervisor[nombre] = valores[i];
    }
    const previo = { mes: clave, todos: ev.todos[i], porSupervisor };
    fs.writeFileSync(cachePath, JSON.stringify({ ...cache, [clave]: previo }, null, 2), "utf-8");
    return previo;
  } catch (err) {
    console.warn(`AVISO: no se pudo obtener la Calidad de ${clave} (${err.message}). El grafico combinado parte un mes despues.`);
    return null;
  }
}

// ---------- 4. Main ----------
async function main() {
  console.log("==> Conectando a la base de datos...");
  const pool = await new sql.ConnectionPool(config).connect();

  console.log("==> Calculando rangos de fecha (mes a la fecha)...");
  const rangoMatriz = await monthToDateRangeMatriz(pool);
  const rangoCalidad = previousMonthRange();
  const inicioAnio = toSqlDate(new Date(Date.UTC(fechaReferencia().getUTCFullYear(), 0, 1)));
  console.log(`==> MATRIZ_VTR (Derivaciones/RGU): ${rangoMatriz.label} [${rangoMatriz.start} a ${rangoMatriz.end})`);
  console.log(`==> CALIDAD_VTR (Calidad): ${rangoCalidad.label} [${rangoCalidad.start} a ${rangoCalidad.end})`);
  console.log(`==> CALIDAD_VTR (Evolutivo mensual): ${inicioAnio} a ${rangoCalidad.end}`);
  console.log(`==> MATRIZ_VTR (Evolutivo mensual RGU): ${inicioAnio} a ${rangoMatriz.end}`);

  console.log("==> Extrayendo datos crudos (sin CTE/JOIN/GROUP BY en el servidor)...");
  const [supervisores, calidadBase, calidadRep, derivBase, rguBase, calidadHistorico, rguHistorico] = await Promise.all([
    fetchSupervisores(pool),
    fetchCalidadBase(pool, rangoCalidad.start, rangoCalidad.end),
    fetchCalidadRepetidos(pool),
    fetchDerivacionesBase(pool, rangoMatriz.start, rangoMatriz.end),
    fetchRguBase(pool, rangoMatriz.start, rangoMatriz.end),
    // Solo hasta rangoCalidad.end (inicio del mes en curso): a diferencia de
    // RGU, Calidad no tiene un numero real que mostrar para el mes en curso
    // (los repetidos necesitan 30 dias para aparecer, asi que un mes recien
    // empezado siempre daria ~0%, engañoso). El ultimo punto del grafico se
    // etiqueta despues con el mes en curso pero usa el valor de este ultimo
    // periodo ya completo -- mismo criterio que la tarjeta "Calidad Agosto".
    fetchCalidadBase(pool, inicioAnio, rangoCalidad.end),
    fetchRguBase(pool, inicioAnio, rangoMatriz.end),
  ]);
  // Calidad del mes anterior al inicio de la serie (diciembre del anio previo):
  // el grafico combinado de supervisor.html rotula la Calidad con el mes en
  // que se reporta, asi que necesita ese mes para que su linea parta en Ene.
  // Es un mes ya cerrado y maduro, y traerlo es una consulta pesada: se
  // calcula una sola vez y queda guardado en reportes/calidad_mes_previo.json.
  const calidadPrevio = await obtenerCalidadMesPrevio(pool, inicioAnio, calidadRep, supervisores);

  // Consulta de estado vecino (mismo calculo que vecino.html). Es un
  // complemento: si falla, el portal se genera igual, sin ese boton.
  let vecino = null;
  try {
    vecino = await obtenerVecino(pool, supervisores);
  } catch (err) {
    console.warn(`AVISO: no se pudo calcular Consulta de estado vecino (${err.message}). El portal se genera sin ese dato.`);
  }
  await pool.close();
  console.log(
    `==> Filas extraidas: Calidad=${calidadBase.length} (+${calidadRep.length} repetidos hist., +${calidadHistorico.length} historico enero-actual) | Derivaciones=${derivBase.length} | RGU=${rguBase.length} (+${rguHistorico.length} historico enero-actual) | Supervisores=${supervisores.size}`
  );

  console.log("==> Calculando indicadores localmente...");
  const { porTecnico: calidad } = calcularCalidad(calidadBase, calidadRep, supervisores);
  const derivaciones = calcularDerivaciones(derivBase, supervisores);
  const rgu = calcularRgu(rguBase, supervisores);
  const { porTecnico: calidadAnual, porDia: historicoPorDia } = calcularCalidad(calidadHistorico, calidadRep, supervisores);
  const evolutivoMensual = construirEvolutivoMensual(historicoPorDia);
  // El ultimo punto de la serie de Calidad queda con la fecha real de sus
  // datos (el ultimo mes calendario completo, ej. agosto), pero se muestra
  // en el grafico como si fuera el mes EN CURSO -- validado con el usuario:
  // el numero real de Calidad de un mes recien empezado siempre da ~0%
  // (los repetidos necesitan 30 dias para aparecer), asi que se prefiere
  // seguir mostrando el ultimo periodo ya reportable, pero etiquetado como
  // "ahora". Mismo criterio que ya usa la tarjeta principal "Calidad Agosto".
  // Los graficos de Calidad mes a mes (portal del tecnico y dashboard de
  // supervisores) ya no usan esa etiqueta corrida solo en el ultimo punto:
  // rotulan todos los puntos con el mes siguiente al de sus cierres, a partir
  // del mes real (mesesReales), y marcan el ultimo como
  // parcial mientras ese mes no cumpla 30 dias de cerrado, porque sus
  // repetidos todavia pueden aumentar y no es comparable con los anteriores.
  evolutivoMensual.mesesReales = [...evolutivoMensual.meses];
  const finUltimoMes = new Date(rangoCalidad.end + "T00:00:00.000Z").getTime();
  evolutivoMensual.ultimoMesParcial = hoyLocal().getTime() < finUltimoMes + 30 * 24 * 60 * 60 * 1000;
  if (evolutivoMensual.meses.length > 0) {
    const mesActualClave = toSqlDate(fechaReferencia()).slice(0, 7);
    evolutivoMensual.meses[evolutivoMensual.meses.length - 1] = mesActualClave;
  }
  evolutivoMensual.previo = calidadPrevio;
  const evolutivoMensualRgu = construirEvolutivoMensualRgu(rguHistorico, supervisores);
  // El ultimo punto es el mes en curso, que aun no cierra: no es comparable
  // con los meses completos. El dia de cierre el ultimo mes ya esta cerrado.
  evolutivoMensualRgu.ultimoMesParcial =
    !esDiaDeCierre() && evolutivoMensualRgu.meses[evolutivoMensualRgu.meses.length - 1] === toSqlDate(hoyLocal()).slice(0, 7);
  console.log(
    `==> Tecnicos con datos: Calidad=${calidad.length} | Derivaciones=${derivaciones.length} | RGU=${rgu.length} | Evolutivo mensual: ${evolutivoMensual.meses.length} meses | Evolutivo mensual RGU: ${evolutivoMensualRgu.meses.length} meses`
  );

  // byRut: agrupa las 3 fuentes por RUT (clave interna, nunca se publica)
  const byRut = new Map();

  function getOrCreate(rut, nombre, supervisor, agencia) {
    const key = normalizeRut(rut);
    if (!byRut.has(key)) {
      byRut.set(key, {
        rut,
        nombre,
        supervisor: supervisor || null,
        agencia: agencia || null,
        calidad: null,
        derivaciones: null,
        rgu: null,
      });
    }
    const t = byRut.get(key);
    if (!t.supervisor && supervisor) t.supervisor = supervisor;
    if (!t.agencia && agencia) t.agencia = agencia;
    return t;
  }

  for (const row of calidad) {
    const t = getOrCreate(row.rut, row.nombre, row.supervisor, row.agencia);
    t.calidad = {
      totalOrdenes: row.totalOrdenes,
      repetidos30Dias: row.repetidos30Dias,
      pctRepetidos: row.totalOrdenes ? (row.repetidos30Dias / row.totalOrdenes) * 100 : 0,
      metaCalidad: metaCalidadPorAgencia(row.agencia),
      causas: row.eventosRepetidos,
    };
  }
  // Mapa aparte (no getOrCreate): la causa anual solo se adjunta a
  // tecnicos que ya existen por Calidad/Derivaciones/RGU del periodo
  // actual, para no sumar al listado tecnicos que solo tienen historial en
  // meses previos y ningun dato en el periodo que muestra el portal.
  const causasAnualPorRut = new Map();
  for (const row of calidadAnual) {
    causasAnualPorRut.set(normalizeRut(row.rut), row.eventosRepetidos);
  }
  for (const row of derivaciones) {
    const t = getOrCreate(row.rut, row.tecnico, row.supervisor, row.agencia);
    t.derivaciones = {
      qOrdenes: row.qOrdenes,
      qDerivaciones: row.qDerivaciones,
      pctDerivaciones: row.qOrdenes ? (row.qDerivaciones / row.qOrdenes) * 100 : 0,
    };
  }
  for (const row of rgu) {
    const t = getOrCreate(row.rut, row.tecnico, row.supervisor, row.agencia);
    t.rgu = {
      rguTotal: row.rguTotal,
      rguCompletadaGsa: row.rguCompletadaGsa,
      diasTrabajados: row.diasTrabajados,
      metaDiaria: row.metaDiaria,
      metaPeriodo: row.metaPeriodo,
      pctCumplimiento: row.pctCumplimiento,
    };
  }

  // ---------- 4b. Excluir tecnicos de baja (lista manual local) ----------
  const rutsBaja = loadRutsBaja();
  let excluidosBaja = 0;
  for (const rut of rutsBaja) {
    if (byRut.delete(rut)) excluidosBaja += 1;
  }
  if (rutsBaja.size > 0) {
    console.log(`==> Tecnicos de baja excluidos: ${excluidosBaja} de ${rutsBaja.size} en la lista.`);
  }

  for (const t of byRut.values()) {
    t.causasAnual = causasAnualPorRut.get(normalizeRut(t.rut)) || [];
  }

  // ---------- 5. idCAT: usuario digital unico (sin clave adicional) ----------
  // idCAT = ultimos 6 caracteres del RUT (K -> 0). Se deriva directamente
  // del RUT, asi que es estable por tecnico y no requiere manejo de
  // colisiones por nombre repetido como antes. Aun asi, dos RUT distintos
  // podrian coincidir por azar en esos 6 caracteres -- se detecta y se
  // avisa en consola si llegara a pasar, porque silenciaria los datos de
  // un tecnico con los de otro.
  const idCatVistos = new Map();
  const credenciales = []; // para el Excel: nunca se embebe en el HTML
  const dataParaHtml = {}; // clave: idCAT

  for (const t of byRut.values()) {
    const usuario = usuarioFromNombre(t.nombre); // solo para mostrar en el Excel
    const idCat = idCatFromRut(t.rut);

    if (idCatVistos.has(idCat)) {
      console.warn(
        `AVISO: idCAT duplicado "${idCat}" entre "${idCatVistos.get(idCat)}" y "${t.nombre}" -- ` +
          `uno de los dos quedara sin acceso propio en el portal. Revisar sus RUT manualmente.`
      );
    }
    idCatVistos.set(idCat, t.nombre);

    credenciales.push({
      idCat,
      usuario,
      nombre: t.nombre,
      agencia: t.agencia || "",
      supervisor: t.supervisor || "",
    });

    const serieMensualPropia = evolutivoMensual.porTecnico[normalizeRut(t.rut)];
    // Solo los meses de ESTE tecnico: en el portal cada uno ve unicamente su
    // cumplimiento (el reporte de todo el equipo es vecino.html, del supervisor).
    const vecinoPropio = vecino
      ? vecino.meses
          .map((m) => ({ mes: m.mes, t: m.tecnicos.get(normalizeRut(t.rut)) }))
          .filter((m) => m.t)
          .map((m) => ({ mes: m.mes, total: m.t.total, conConsulta: m.t.conConsulta, nok: m.t.nok, sinConsulta: m.t.sinConsulta }))
      : [];
    // % del mes que muestra el portal, para la tabla del dashboard de supervisores.
    const vecinoMes = vecino ? vecinoPropio.find((m) => m.mes === vecino.mesInicial) : null;
    t.vecinoResumen = vecinoMes
      ? { total: vecinoMes.total, conConsulta: vecinoMes.conConsulta, pct: (vecinoMes.conConsulta / vecinoMes.total) * 100 }
      : null;
    dataParaHtml[idCat] = {
      nombre: t.nombre,
      supervisor: t.supervisor,
      agencia: t.agencia,
      calidad: t.calidad,
      derivaciones: t.derivaciones,
      rgu: t.rgu,
      evolutivoMensualPropio: serieMensualPropia
        ? {
            meses: evolutivoMensual.meses,
            mesesReales: evolutivoMensual.mesesReales,
            ultimoMesParcial: evolutivoMensual.ultimoMesParcial,
            valores: serieMensualPropia,
          }
        : null,
      vecino: vecino && vecino.mesInicial ? { meta: vecino.meta, mesInicial: vecino.mesInicial, meses: vecinoPropio } : null,
    };
  }

  // ---------- 6. Generar index.html a partir de template.html ----------
  const templatePath = path.join(__dirname, "template.html");
  const template = fs.readFileSync(templatePath, "utf-8");
  const dataCompleta = {
    generadoEl: new Date().toLocaleString("es-CL"),
    periodoCalidad: rangoCalidad.label,
    periodoMatriz: rangoMatriz.label,
    cierreMes: esDiaDeCierre(),
    tecnicos: dataParaHtml,
  };
  // El portal avisa a Supabase cada vez que un tecnico entra con su ID (registro
  // de ingresos, se ve en admin.html). Solo lleva la direccion y la llave publica.
  const envAcceso = leerEnv();
  const html = template
    .replace("__DATA_JSON__", () => jsonParaScript(dataCompleta))
    .replace("__SUPABASE_URL__", () => (envAcceso.SUPABASE_URL || "").replace(/\/+$/, ""))
    .replace("__SUPABASE_KEY__", () => envAcceso.SUPABASE_ANON_KEY || "");
  try {
    await sincronizarTecnicos(Object.entries(dataParaHtml).map(([id, t]) => ({ id, nombre: t.nombre, supervisor: t.supervisor || "", agencia: t.agencia || "" })));
  } catch (err) {
    console.warn(`AVISO: no se actualizo la lista de tecnicos del registro de ingresos. El portal se genera igual. Detalle: ${err.message}`);
  }

  const outPath = path.join(__dirname, "index.html");
  fs.writeFileSync(outPath, html, "utf-8");
  console.log(`==> Generado: ${outPath}`);

  // ---------- 6b. Generar supervisor.html (dashboard de equipos, sin RUT) ----------
  // Se publica cifrado, detras del ingreso con usuario y clave (reportes/proteger.js);
  // la copia sin cifrar queda en privado/supervisor.html.
  const templateSupPath = path.join(__dirname, "template-supervisor.html");
  const templateSup = fs.readFileSync(templateSupPath, "utf-8");
  const dataSupervisor = {
    generadoEl: dataCompleta.generadoEl,
    periodoCalidad: rangoCalidad.label,
    periodoMatriz: rangoMatriz.label,
    cierreMes: esDiaDeCierre(),
    tecnicos: [...byRut.values()].map((t) => ({
      nombre: t.nombre,
      agencia: t.agencia,
      supervisor: t.supervisor,
      calidad: t.calidad,
      causasAnual: t.causasAnual || [],
      derivaciones: t.derivaciones,
      rgu: t.rgu,
      vecino: t.vecinoResumen || null,
    })),
    evolutivoMensual,
    evolutivoMensualRgu,
  };
  // El formato visual (sistema de diseno de la Academia Tecnica) vive en un solo
  // archivo, compartido con reiteradas.html y vecino.html; se incrusta en la pagina.
  const estiloAcademia = fs.readFileSync(path.join(__dirname, "reportes", "estilo-academia.css"), "utf-8");
  const htmlSup = templateSup
    .replace("/*__ESTILO_ACADEMIA__*/", () => estiloAcademia)
    .replace("__DATA_SUPERVISOR_JSON__", () => jsonParaScript(dataSupervisor));
  const outSupPath = await publicarProtegida(htmlSup, "supervisor.html", "supervisor", "Dashboard de supervisores");
  console.log(`==> Generado: ${outSupPath}`);

  // ---------- 7. Generar Excel de credenciales (NO se sube a git) ----------
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Credenciales");
  ws.columns = [
    { header: "ID", key: "idCat", width: 12 },
    { header: "Nombre completo", key: "nombre", width: 34 },
    { header: "Agencia", key: "agencia", width: 14 },
    { header: "Supervisor", key: "supervisor", width: 30 },
  ];
  ws.getRow(1).font = { bold: true };
  credenciales
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .forEach((c) => ws.addRow(c));

  const credPath = path.join(__dirname, "Credenciales_Tecnicos_NO_SUBIR.xlsx");
  try {
    await wb.xlsx.writeFile(credPath);
    console.log(`==> Generado: ${credPath}`);
  } catch (err) {
    console.warn(
      `AVISO: no se pudo escribir ${credPath} (¿está abierto en Excel?). ` +
        `El portal (index.html) se genero igual. Detalle: ${err.message}`
    );
  }

  console.log(`\nListo. ${byRut.size} tecnicos. Calidad: ${rangoCalidad.label} | Derivaciones/RGU: ${rangoMatriz.label}.`);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
