// Brecha a la meta de Produccion RGU: cuanto le falta a cada tecnico y cuanto
// necesita por dia para cerrar el mes en 100 %. Lo usan generar_portal.js
// (portal del tecnico) y reportes/generar_brecha.js (pagina de supervisores),
// para que ambos den siempre lo mismo.

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// Sobre este RGU diario necesario, la meta se considera fuera de alcance.
const RGU_DIARIO_ALCANZABLE = 7;

// "1 al 29 de septiembre de 2026" -> { anio: 2026, mes: 8, dia: 29 }
function parsearPeriodo(label) {
  const m = /^1 al (\d{1,2}) de (\w+) de (\d{4})$/.exec(String(label || "").trim());
  const mes = m ? MESES.indexOf(m[2].toLowerCase()) : -1;
  if (!m || mes === -1) throw new Error(`periodo "${label}" no tiene el formato esperado`);
  return { anio: parseInt(m[3], 10), mes, dia: parseInt(m[1], 10) };
}

// Mismo calendario que la hoja "Metas | Cumplimiento" del Excel de produccion
// (columna ENTERO): domingo y feriado no cuentan; lunes a sabado cuentan como
// un dia completo. Los feriados se mantienen a mano en Feriados.json.
function cargarFeriados(anio) {
  const lista = JSON.parse(fs.readFileSync(path.join(RAIZ, "Feriados.json"), "utf-8"));
  if (!lista.some((f) => String(f.fecha).startsWith(anio + "-"))) {
    console.warn(`AVISO: Feriados.json no tiene feriados de ${anio}; la brecha los cuenta como dias habiles.`);
  }
  return new Set(lista.map((f) => f.fecha));
}

// Dias habiles del mes del periodo: totales, transcurridos (hasta el ultimo dia
// con datos) y restantes.
function calendarioMes(periodoLabel) {
  const p = parsearPeriodo(periodoLabel);
  const feriados = cargarFeriados(p.anio);
  const total = new Date(Date.UTC(p.anio, p.mes + 1, 0)).getUTCDate();
  const habiles = [];
  for (let d = 1; d <= total; d++) {
    const fecha = new Date(Date.UTC(p.anio, p.mes, d));
    if (fecha.getUTCDay() !== 0 && !feriados.has(fecha.toISOString().slice(0, 10))) habiles.push(d);
  }
  const cal = { totales: habiles.length, transcurridos: habiles.filter((d) => d <= p.dia).length };
  cal.restantes = cal.totales - cal.transcurridos;
  return cal;
}

// rgu = { rguCompletadaGsa, diasTrabajados, metaDiaria } del tecnico.
function calcularBrecha(rgu, cal) {
  const { rguCompletadaGsa: hecho, diasTrabajados: dias, metaDiaria } = rgu;
  const metaHoy = metaDiaria * dias;
  const faltan = Math.max(0, metaHoy - hecho);
  // Supone que el tecnico trabaja todos los dias habiles que quedan.
  const necesitaTotal = metaDiaria * (dias + cal.restantes) - hecho;
  const necesitaPorDia = cal.restantes > 0 ? Math.max(0, necesitaTotal / cal.restantes) : null;
  const pct = metaHoy ? (hecho / metaHoy) * 100 : 0;

  let estado;
  if (cal.restantes === 0) estado = pct >= 100 ? "ok" : "bad";
  else if (pct >= 100) estado = "ok";
  else estado = necesitaPorDia <= RGU_DIARIO_ALCANZABLE ? "warn" : "bad";

  const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
  return {
    pct: r2(pct),
    faltan: r2(faltan),
    necesitaPorDia: r2(necesitaPorDia),
    // Igual que "RGU Proyectados" del Excel: mismo factor para todos.
    rguProyectado: cal.transcurridos ? r2((hecho / cal.transcurridos) * cal.totales) : null,
    restantes: cal.restantes,
    estado,
  };
}

module.exports = { calendarioMes, calcularBrecha, RGU_DIARIO_ALCANZABLE };
