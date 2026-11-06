// "Indicadores de calidad" para el portal del supervisor: un indice (indicadores.html) y una pagina por indicador
// (NPS, Control de Bloqueos, Auditorias QA y OT Digital) de COBRA. Se publican cifradas;
// la copia sin cifrar queda en privado/. Los datos los deja el flujo en Python
// (C:\Bases_Vtr\Informe_Ranking_IPTV\Envios\otros_datos.json: sin RUT). Otra ruta del JSON: OTROS_DATOS en el entorno.
const fs = require("fs");
const path = require("path");
const { publicarProtegida } = require("./proteger.js");

const archivo = process.env.OTROS_DATOS || "C:\\Bases_Vtr\\Informe_Ranking_IPTV\\Envios\\otros_datos.json";
if (!fs.existsSync(archivo)) { console.error("ERROR: no encuentro", archivo); process.exit(1); }
const DATA = JSON.parse(fs.readFileSync(archivo, "utf-8"));
const cssAcademia = fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8");

const CSS = String.raw`:root{ --bg:#eef1f4; --panel:#fff; --border:#e0e5ea; --text:#22303f; --dim:#6b7a8c; --navy:#003c71; --blue:#0071ce; --c1:#1f3a5f; --c2:#7f9bb8; }
*{box-sizing:border-box;} body{ margin:0; font-family:'Segoe UI',Arial,sans-serif; background:var(--bg); color:var(--text); }
.brand-row{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; } .brand-row img{ height:36px; } .brand-divider{ width:1px; height:28px; background:var(--border); }
.link-portal{ color:var(--blue); font-weight:700; font-size:13px; text-decoration:none; }
main{ padding:24px clamp(16px,3vw,56px) 60px; max-width:1400px; margin:0 auto; }
main .panel{ background:#fff; border:1px solid var(--border); border-top:3px solid var(--navy); border-radius:12px; padding:18px 20px; margin-bottom:18px; }
main .panel h2{ margin:0 0 4px; font-size:13px; letter-spacing:.12em; text-transform:uppercase; color:var(--blue); font-weight:800; }
main .panel .exp{ margin:0 0 14px; font-size:13px; color:var(--dim); }
.filtro{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
.filtro label{ font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.filtro select{ font:inherit; font-size:14px; padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:#fff; color:var(--text); min-width:220px; }
.cards{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; }
.card{ border:1px solid var(--border); border-radius:10px; padding:12px 14px; background:#fff; animation:entra .8s cubic-bezier(.2,.7,.2,1) both; } .card:nth-child(2){ animation-delay:.1s; } .card:nth-child(3){ animation-delay:.2s; } .card:nth-child(4){ animation-delay:.3s; } .card:nth-child(5){ animation-delay:.4s; } .card:nth-child(6){ animation-delay:.5s; }
.card .k{ font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); } .card .v{ font-size:24px; font-weight:800; color:var(--navy); line-height:1.15; margin-top:4px; } .card .s{ font-size:12px; color:var(--dim); margin-top:2px; }
.dos{ display:grid; grid-template-columns:1fr 1fr; gap:22px 28px; } .bloque h3{ margin:0 0 10px; font-size:13px; font-weight:800; color:var(--text); }
.tabla-wrap{ overflow-x:auto; }
table.t{ width:100%; border-collapse:collapse; font-size:13px; }
table.t th{ background:#f3f5f8; color:var(--text); font-size:12px; font-weight:700; padding:8px 8px; border-bottom:2px solid var(--navy); text-align:left; vertical-align:bottom; }
table.t td{ padding:7px 8px; border-bottom:1px solid #e6ebf0; vertical-align:top; } table.t td.n, table.t th.n{ text-align:right; white-space:nowrap; }
table.t td.nom{ font-weight:600; white-space:nowrap; } table.t td.sup{ font-size:12.5px; color:var(--dim); white-space:nowrap; } table.t td.det{ font-size:12px; color:var(--dim); }
table.t tr:hover td{ background:#f7f9fb; }
.chip{ display:inline-block; font-size:12px; font-weight:700; color:var(--navy); background:#eaf0f8; border-radius:999px; padding:2px 9px; white-space:nowrap; } .chip.g{ background:#e5eaf0; color:#33414f; } .chip.o{ background:#dfe7f1; color:#1f3a5f; }
.hb{ display:grid; grid-template-columns:150px 1fr 56px; align-items:center; gap:10px; font-size:12.5px; margin:6px 0; } .hb .bb{ height:10px; background:#eef1f4; border-radius:5px; overflow:hidden; } .hb .bb i{ display:block; height:100%; border-radius:5px; background:var(--c2); transform-origin:left center; animation:crece 1.6s cubic-bezier(.2,.7,.2,1) .3s both; } .hb .vl{ text-align:right; color:var(--dim); font-variant-numeric:tabular-nums; }
.leyenda{ display:flex; gap:14px; flex-wrap:wrap; font-size:12px; color:var(--dim); margin-top:6px; } .leyenda span::before{ content:""; display:inline-block; width:10px; height:10px; border-radius:2px; background:var(--k); margin-right:5px; vertical-align:-1px; }
.lee{ background:#f3f6fa; border-left:3px solid var(--c2); border-radius:6px; padding:10px 14px; margin:0 0 16px; font-size:13px; line-height:1.5; color:#33414f; } .lee b{ color:var(--navy); } .lee p{ margin:0 0 4px; } .lee p:last-child{ margin:0; }
.lect{ background:#fff; border:1px dashed #b9c6d4; border-radius:6px; padding:10px 14px; margin:14px 0 0; font-size:13px; line-height:1.5; color:#22303f; } .lect:empty{ display:none; } .lect b{ color:var(--navy); }
.glos dt{ font-weight:800; color:var(--navy); font-size:13px; margin-top:10px; } .glos dd{ margin:2px 0 0; font-size:13px; color:#33414f; line-height:1.5; }
.pie-dato{ font-size:12px; color:var(--dim); margin-top:10px; } .vacio{ font-size:13px; color:var(--dim); padding:6px 0; }
.rv{ opacity:0; transform:translateY(22px); } .rv.rv-ver{ opacity:1; transform:none; transition:opacity .95s ease, transform .95s cubic-bezier(.2,.7,.2,1); }
@keyframes entra{ from{ opacity:0; transform:translateY(16px); } to{ opacity:1; transform:none; } }
@keyframes crece{ from{ transform:scaleX(0); } to{ transform:scaleX(1); } }
@keyframes trazo{ from{ stroke-dashoffset:1; } to{ stroke-dashoffset:0; } }
table.t tr:not(:first-child){ animation:fila .6s ease both; } @keyframes fila{ from{ opacity:0; transform:translateX(-10px); } to{ opacity:1; transform:none; } }
.rv:not(.rv-ver) :is(.hb .bb i, table.t tr){ animation-play-state:paused; }
@media (prefers-reduced-motion:reduce){ .rv{ opacity:1; transform:none; } .card,table.t tr,.hb .bb i{ animation:none!important; } }
@media (max-width:760px){ .dos{ grid-template-columns:1fr; } .hb{ grid-template-columns:110px 1fr 50px; } table.t td.sup, table.t th.sup{ display:none; } }

.menu{ display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px; }
.mcard{ display:flex; flex-direction:column; gap:4px; text-decoration:none; color:inherit; border:1px solid var(--border); border-top:3px solid var(--c2); border-radius:10px; padding:14px 16px; background:#fff; transition:box-shadow .15s, transform .15s; animation:entra .8s cubic-bezier(.2,.7,.2,1) both; }
.mcard:hover{ box-shadow:0 4px 14px rgba(0,60,113,.12); transform:translateY(-2px); }
.mcard .mt{ font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--blue); } .mcard .mv{ font-size:26px; font-weight:800; color:var(--navy); line-height:1.15; } .mcard .ms{ font-size:12px; color:var(--dim); }
.mcard .md{ font-size:13px; color:#33414f; line-height:1.45; margin-top:6px; } .mcard .mg{ font-size:12.5px; font-weight:700; color:var(--blue); margin-top:8px; }
`;

const AYUDAS = {
  nps: '<div class="lee"><p><b>Qué es:</b> el NPS resta, de las encuestas, el porcentaje de clientes que no recomendarían al técnico (detractores) al porcentaje que sí lo recomendarían (promotores).</p><p><b>Cómo leerlo:</b> va de -100 a 100. Sobre 0 hay más clientes contentos que molestos; mientras más alto, mejor. Con pocas encuestas en un mes la línea sube y baja mucho.</p></div>',
  bloqueos: '<div class="lee"><p><b>Qué es:</b> cada vez que un técnico incumple un control (alarmas, interacción sin morador, herramientas, adherencia, etc.) recibe un strike. Los strikes se acumulan: el 1.º y el 2.º son advertencias, el 3.º puede llevar a bloqueo y algunas faltas graves son salida directa.</p><p><b>Cómo leerlo:</b> la lista va de mayor a menor gravedad. Los técnicos de arriba son los que conviene conversar primero. "Eventos" son las veces que quedó registrado en el control.</p></div>',
  qa: '<div class="lee"><p><b>Qué es:</b> auditores revisan en terreno, en la casa del cliente, si el técnico siguió el protocolo de atención y dejó bien la revisión exterior e interior.</p><p><b>Cómo leerlo:</b> el porcentaje es el cumplimiento de cada tramo de la auditoría. Son pocas visitas por mes, así que un solo caso mueve mucho el resultado.</p></div>',
};
AYUDAS.otdigital = '<div class="lee"><p><b>Qué es:</b> OT Digital mide si el técnico cierra la orden de trabajo en el sistema como corresponde, completando los pasos digitales de la visita. Cada orden cuenta como "cumple" o "no cumple".</p><p><b>Cómo leerlo:</b> mientras más alto el porcentaje de cumplimiento, mejor. Los técnicos de arriba son los que menos cumplen en los últimos 30 días.</p></div>';
const GLOSARIO = {
  nps: [["NPS", "Porcentaje de promotores menos porcentaje de detractores. Va de -100 a 100."], ["Promotor / detractor", "Cliente que recomendaría al técnico / cliente que no lo recomendaría."], ["Técnico incidente en detractor", "Técnico al que la encuesta de un cliente detractor le atribuye la causa (mala atención, falta de procedimiento, etc.). No es un NPS por técnico: son pocas encuestas por persona."]],
  bloqueos: [["Strike", "Falta registrada a un técnico en un control. Se acumulan; al 3.º puede haber bloqueo. La salida directa es para faltas graves."], ["Estado Advertencia", "El técnico tiene strikes, pero sigue trabajando con normalidad. Bloqueo indefinido significa que ya no puede trabajar."], ["Eventos", "Veces que el técnico quedó registrado en alguno de los controles."]],
  qa: [["Adherencia", "Cumplimiento del protocolo de trabajo medido en una auditoría presencial."], ["Auditoría completa", "La que revisa exterior e interior de la casa; algunas son solo exterior."]],
  otdigital: [["OT Digital", "Cierre de la orden de trabajo en el sistema con los pasos digitales completos."], ["Cumple / No cumple", "Orden que se cerró bien digitalmente / orden que quedó con algún paso sin completar."]],
};
const PAGINAS = {
  nps: { archivo: "indicadores_nps.html", titulo: "NPS · satisfacción del cliente", corto: "NPS", sub: "Cómo califican los clientes de COBRA las instalaciones y las operaciones (reparaciones).", filtro: true },
  bloqueos: { archivo: "indicadores_bloqueos.html", titulo: "Control de bloqueos · strikes", corto: "Control de bloqueos", sub: "Técnicos con strikes por incumplir controles, y cuáles están más cerca de un bloqueo.", filtro: true },
  qa: { archivo: "indicadores_qa.html", titulo: "Auditorías de calidad · adherencia en terreno", corto: "Auditorías de calidad", sub: "Resultado de las auditorías presenciales a técnicos de COBRA.", filtro: true },
  otdigital: { archivo: "indicadores_otdigital.html", titulo: "OT Digital · cierre correcto de órdenes", corto: "OT Digital", sub: "Cumplimiento de OT Digital de cada técnico de COBRA en los últimos 30 días.", filtro: true },
};

function cuerpo(clave) {
  const P = PAGINAS[clave];
  const filtro = P.filtro ? '<div class="filtro"><label for="sup">Supervisor</label><select id="sup"></select></div>' : "";
  const gl = '<div class="panel"><h2>Glosario</h2><dl class="glos">' + GLOSARIO[clave].map((g) => "<dt>" + g[0] + "</dt><dd>" + g[1] + "</dd>").join("") + '</dl><p class="pie-dato">Fuente: Power BI "Repositorio Operaciones EPS", actualizado cada día.</p></div>';
  const cards = '<div class="cards" id="cards"></div>';
  const piezas = {
    nps: '<div class="panel"><h2>Resumen</h2>' + filtro + cards + "</div>" + '<div class="panel"><h2>Cómo califican los clientes</h2>' + AYUDAS.nps + '<div class="dos"><div class="bloque"><h3>NPS por mes</h3><div id="npsLinea"></div><div class="leyenda"><span style="--k:#1f3a5f">Instalaciones</span><span style="--k:#7f9bb8">Operaciones</span></div></div><div class="bloque"><h3>Atributos · instalaciones</h3><div id="npsAi"></div><h3 style="margin-top:14px">Atributos · operaciones</h3><div id="npsAo"></div></div></div><div class="lect" id="lNps"></div></div>' + '<div class="panel"><h2>Técnicos con encuestas de detractor</h2><p class="exp">Un detractor es un cliente que calificó con nota baja. Aquí están los técnicos activos a los que una encuesta de detractor les atribuye la causa.</p><div class="tabla-wrap"><table class="t" id="tDet"></table></div><p class="pie-dato" id="detPie"></p></div>',
    bloqueos: '<div class="panel"><h2>Resumen</h2>' + filtro + cards + "</div>" + '<div class="panel"><h2>Técnicos con strikes</h2><p class="exp" id="bloqExp"></p>' + AYUDAS.bloqueos + '<div id="bloqProy" class="leyenda" style="margin:0 0 12px"></div><div class="tabla-wrap"><table class="t" id="tBloq"></table></div><p class="pie-dato" id="bloqPie"></p><div class="lect" id="lBloq"></div></div>',
    qa: '<div class="panel"><h2>Resumen</h2>' + filtro + cards + "</div>" + '<div class="panel"><h2>Resultado de las auditorías</h2><p class="exp" id="qaExp"></p>' + AYUDAS.qa + '<div class="dos"><div class="bloque"><h3>Adherencia por segmento</h3><div id="qaSeg"></div></div><div class="bloque"><h3>Nota por mes</h3><div id="qaMes"></div></div></div><h3 style="margin:18px 0 8px;font-size:13px">Técnicos auditados</h3><div class="tabla-wrap"><table class="t" id="tQa"></table></div><div class="lect" id="lQa"></div></div>',
    otdigital: '<div class="panel"><h2>Resumen</h2>' + filtro + cards + "</div>" + '<div class="panel"><h2>Cumplimiento por técnico</h2><p class="exp" id="odExp"></p>' + AYUDAS.otdigital + '<div class="dos"><div class="bloque"><h3>Por tipo de actividad</h3><div id="odAct"></div></div><div class="bloque"><h3>Por semana</h3><div id="odSem"></div></div></div><h3 style="margin:18px 0 8px;font-size:13px">Técnicos</h3><div class="tabla-wrap"><table class="t" id="tOd"></table></div><p class="pie-dato" id="odPie"></p><div class="lect" id="lOd"></div></div>',
  };
  return piezas[clave] + gl;
}

const SHARED = String.raw`
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ac = (t) => String(t).replace(/tecnico/gi, (m) => m[0] + "écnico").replace(/presentacion/gi, (m) => m.slice(0, 7) + "ación").replace(/informacion/gi, "información").replace(/^./, (c) => c.toUpperCase());
const dec = (x, n) => x.toFixed(n === undefined ? 1 : n).replace(".", ",");
const pct = (x) => dec(100 * x) + "%";
const MESES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const NPS = DATA.nps || {}, BL = DATA.bloqueos || {}, QA = DATA.qa || {};
const bTec = (BL.tecnicos || []).filter((t) => t.activo), qTec = QA.tecnicos || [];
const fechaDatos = DATA.generado.slice(0, 10).split("-").reverse().join("-");
const qs = new URLSearchParams(location.search).get("supervisor");
const sel = document.getElementById("sup");
function iniciarFiltro(lista, alCambiar) {
  if (!sel) return;
  const sups = Array.from(new Set(lista)).sort();
  sel.innerHTML = '<option value="">Todos los supervisores</option>' + sups.map((s) => "<option>" + esc(s) + "</option>").join("");
  if (qs && sups.indexOf(qs) >= 0) sel.value = qs;
  sel.addEventListener("change", alCambiar);
}
const sup = () => (sel ? sel.value : "");
const poner = (id, t) => { const e = document.getElementById(id); if (e) e.innerHTML = t; };
function tarjetasHtml(c) { return c.map((x) => '<div class="card"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="s">' + esc(x[2]) + "</div></div>").join(""); }
function activarAnimacion() {
  const SIN = !("IntersectionObserver" in window) || !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  document.querySelectorAll("main .panel").forEach(function (p) {
    if (SIN) return;
    p.classList.add("rv");
    const o = new IntersectionObserver(function (en) { if (en.some(function (x) { return x.isIntersecting; })) { o.disconnect(); p.classList.add("rv-ver"); } }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    o.observe(p);
  });
}
function lineas(el, etiquetas, series, lo, hi, fmt) {
  const W = 540, H = 200, L = 40, R = 26, T = 18, B = 26, n = etiquetas.length;
  if (!n) { document.getElementById(el).innerHTML = '<p class="vacio">Sin datos.</p>'; return; }
  const px = (i) => L + (n > 1 ? i * (W - L - R) / (n - 1) : 0), py = (v) => T + (hi - v) * (H - T - B) / (hi - lo);
  let g = "";
  const paso = (hi - lo) / 4;
  for (let k = 0; k <= 4; k++) { const v = lo + k * paso; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + py(v) + '" y2="' + py(v) + '" stroke="#e6ebf0"/><text x="' + (L - 6) + '" y="' + (py(v) + 4) + '" text-anchor="end" font-size="11" fill="#6b7a8c">' + fmt(v) + "</text>"; }
  series.forEach((s) => {
    const pts = s.v.map((v, i) => v === null ? null : px(i) + "," + py(v)).filter(Boolean).join(" ");
    g += '<polyline points="' + pts + '" fill="none" stroke="' + s.c + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" pathLength="1" style="stroke-dasharray:1;animation:trazo 1.8s ease .3s both"/>';
    s.v.forEach((v, i) => { if (v !== null) g += '<circle cx="' + px(i) + '" cy="' + py(v) + '" r="3" fill="' + s.c + '"><title>' + esc(s.n + ": " + fmt(v)) + "</title></circle>"; });
    if (s.etq) s.v.forEach((v, i) => { if (v !== null) g += '<text x="' + px(i) + '" y="' + (py(v) - 8) + '" text-anchor="middle" font-size="10.5" fill="#33414f">' + fmt(v) + "</text>"; });
  });
  etiquetas.forEach((e, i) => { g += '<text x="' + px(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="#6b7a8c">' + esc(e) + "</text>"; });
  document.getElementById(el).innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" style="display:block;max-width:520px;margin:0" role="img">' + g + "</svg>";
}
function barras(el, filas, fmt, max) {
  document.getElementById(el).innerHTML = filas.length ? filas.map((f) => '<div class="hb"><span>' + esc(f.n) + '</span><span class="bb"><i style="width:' + Math.max(0, Math.min(100, 100 * f.v / max)) + '%"></i></span><span class="vl">' + fmt(f.v) + "</span></div>").join("") : '<p class="vacio">Sin datos.</p>';
}

`;

const ESPECIFICO = {
  nps: String.raw`
function pintar() {
  const m = NPS.meses || {};
  const meses = Array.from(new Set((m.inst || []).concat(m.oper || []).map((z) => z.mes))).sort((a, b) => a - b);
  const val = (arr, mes) => { const z = (arr || []).find((q) => q.mes === mes); return z ? z.nps : null; };
  lineas("npsLinea", meses.map((x) => MESES[x]), [{ n: "Instalaciones", c: "#1f3a5f", v: meses.map((x) => val(m.inst, x)) }, { n: "Operaciones", c: "#7f9bb8", v: meses.map((x) => val(m.oper, x)) }], -100, 100, (v) => String(Math.round(v)));
  const A = NPS.atributos || {};
  barras("npsAi", (A.inst || []).map((z) => ({ n: ac(z.atributo), v: z.nps })), (v) => dec(v, 0), 100);
  barras("npsAo", (A.oper || []).map((z) => ({ n: ac(z.atributo), v: z.nps })), (v) => dec(v, 0), 100);
  const c = [];
  if (NPS.inst !== undefined) c.push(["NPS instalaciones", dec(NPS.inst, 1), (NPS.encInst || "") + " encuestas"]);
  if (NPS.oper !== undefined) c.push(["NPS operaciones", dec(NPS.oper, 1), (NPS.encOper || "") + " encuestas"]);
  poner("cards", tarjetasHtml(c));
  const peor = (arr) => (arr || []).slice().sort((a, b) => a.nps - b.nps)[0], mejor = (arr) => (arr || []).slice().sort((a, b) => b.nps - a.nps)[0];
  const pi = peor(A.inst), mi = mejor(A.inst);
  poner("lNps", NPS.inst === undefined ? "" : "<b>Lectura:</b> las instalaciones tienen un NPS de <b>" + dec(NPS.inst, 1) + "</b> y las operaciones de <b>" + dec(NPS.oper, 1) + "</b>; ambos están sobre cero, es decir, hay más clientes que recomiendan que clientes que no." + (pi && mi ? " En instalaciones lo mejor valorado es <b>" + esc(ac(mi.atributo).toLowerCase()) + "</b> (" + dec(mi.nps, 0) + ") y lo más bajo <b>" + esc(ac(pi.atributo).toLowerCase()) + "</b> (" + dec(pi.nps, 0) + "), que es donde hay más que mejorar." : ""));
  const s = sup(), det =(NPS.detractores || []).filter((d) => d.activo && (!s || d.supervisor === s));
  const cab = '<tr><th>Técnico</th><th class="sup">Supervisor</th><th>Encuesta</th><th>Fecha</th><th>Motivo del cliente</th></tr>';
  document.getElementById("tDet").innerHTML = det.length ? cab + det.map((d) => '<tr><td class="nom">' + esc(d.nombre) + '</td><td class="sup">' + esc(d.supervisor) + '</td><td>' + esc(d.encuesta) + '</td><td>' + esc(d.fechaEncuesta.split("-").reverse().join("-")) + '</td><td class="det">' + esc(d.categoria + " · " + d.incidencia + " · " + d.motivo) + "</td></tr>").join("") : "<tr><td>Sin técnicos activos con encuestas de detractor" + (s ? " en este equipo" : "") + ".</td></tr>";
  const fuera = (NPS.detractores || []).filter((d) => !d.activo).length;
  poner("detPie", (fuera ? "No se muestran " + fuera + " técnicos que ya no están activos. " : "") + "Datos del " + fechaDatos + ".");
}
iniciarFiltro((NPS.detractores || []).filter((d) => d.activo).map((d) => d.supervisor), pintar);
pintar();
`,
  bloqueos: String.raw`
function pintar() {
  const s = sup(), arr = bTec.filter((t) => !s || t.supervisor === s);
  const n3 = arr.filter((t) => t.nivel >= 3), n2 = arr.filter((t) => t.nivel === 2);
  poner("cards", tarjetasHtml([["Técnicos con strikes", String(arr.length), s ? "equipo de " + s : "técnicos activos de COBRA"], ["En 2.º strike", String(n2.length), "a un paso del 3.º"], ["En 3.º strike o más", String(n3.length), n3.length ? "prioridad" : "ninguno"]].concat(BL.peligro && !s ? [["En peligro según Power BI", BL.peligro.tecnicos + " de " + BL.peligro.dotacion, "dotación activa del control"]] : [])));
  document.getElementById("bloqExp").textContent = "Técnicos activos con strikes registrados en el control de bloqueos.";
  poner("bloqProy", (BL.porProyecto || []).slice(0, 6).map((p) => '<span style="--k:#7f9bb8">' + esc(p[0]) + ": " + p[1] + "</span>").join(""));
  const cab = '<tr><th class="n">#</th><th>Técnico</th><th class="sup">Supervisor</th><th>Último strike</th><th>Estado</th><th class="n">Eventos</th><th>Motivos principales</th><th>Última semana</th></tr>';
  const cu = arr.map((t, i) => '<tr><td class="n">' + (i + 1) + '</td><td class="nom">' + esc(t.nombre) + '</td><td class="sup">' + esc(t.supervisor) + '</td><td><span class="chip' + (t.nivel >= 3 ? " o" : "") + '">' + esc(t.strike || "—") + '</span></td><td>' + esc(t.estado || "—") + '</td><td class="n">' + t.eventos + '</td><td class="det">' + esc(t.proyectos.map((p) => p[0] + " (" + p[1] + ")").join(" · ")) + '</td><td>' + esc(t.ultimaSemana) + "</td></tr>").join("");
  document.getElementById("tBloq").innerHTML = arr.length ? cab + cu : "<tr><td>Sin técnicos con strikes" + (s ? " en este equipo" : "") + ".</td></tr>";
  const bajas = (BL.tecnicos || []).filter((t) => !t.activo).length;
  poner("bloqPie", bajas ? "No se muestran " + bajas + " técnicos con strikes que ya no están activos en la dotación. Datos del " + fechaDatos + "." : "Datos del " + fechaDatos + ".");
  poner("lBloq", arr.length ? "<b>Lectura:</b> " + (s ? "En el equipo de " + esc(s) + " hay " : "Hay ") + "<b>" + arr.length + "</b> técnicos con strikes: " + n3.length + " en 3.º strike o más, " + n2.length + " en 2.º y " + (arr.length - n3.length - n2.length) + " en 1.º." + (n3.length ? " <b>Prioridad:</b> " + n3.map((t) => esc(t.nombre)).join(", ") + "." : " Nadie está en 3.º strike.") : "");
}
iniciarFiltro(bTec.map((t) => t.supervisor), pintar);
pintar();
`,
  qa: String.raw`
function pintar() {
  const s = sup(), r = QA.resumen;
  const arr = qTec.filter((t) => !s || t.supervisor === s);
  const c = [];
  if (r && r.nota !== null) c.push(["Adherencia general", pct(r.nota), "nota de las auditorías a COBRA"]);
  if (r) c.push(["Auditorías", String(r.total), r.completadas + " completas (exterior e interior)"]);
  c.push(["Técnicos auditados", String(arr.length), s ? "equipo de " + s : "de COBRA"]);
  poner("cards", tarjetasHtml(c));
  document.getElementById("qaExp").textContent = r ? "Auditorías en terreno a técnicos de COBRA: " + r.completadas + " completas de " + r.total + ". Datos del " + fechaDatos + "." : "Auditorías en terreno a técnicos de COBRA.";
  barras("qaSeg", (QA.segmentos || []).map((z) => ({ n: z.segmento, v: z.pct })), (v) => pct(v), 1);
  barras("qaMes", (QA.meses || []).map((z) => ({ n: z.mes.charAt(0).toUpperCase() + z.mes.slice(1) + " (" + z.q + ")", v: z.nota || 0 })), (v) => pct(v), 1);
  const cab = '<tr><th>Técnico</th><th class="sup">Supervisor</th><th class="n">Auditorías</th><th>Observaciones de la auditoría</th></tr>';
  const cu = arr.map((t) => '<tr><td class="nom">' + esc(t.nombre) + '</td><td class="sup">' + esc(t.supervisor) + '</td><td class="n">' + t.auditorias + '</td><td class="det">' + (t.obs.length ? esc(t.obs.join(" · ")) : "Sin observaciones") + "</td></tr>").join("");
  document.getElementById("tQa").innerHTML = arr.length ? cab + cu : "<tr><td>Sin auditorías" + (s ? " en este equipo" : "") + ".</td></tr>";
  const seg = (QA.segmentos || []).slice().sort((a, b) => a.pct - b.pct)[0];
  poner("lQa", r ? "<b>Lectura:</b> la adherencia general es <b>" + pct(r.nota) + "</b> con solo " + r.total + " auditorías, por eso conviene mirarla como orientación y no como resultado definitivo." + (seg ? " El punto más débil es <b>" + esc(seg.segmento.toLowerCase()) + "</b> (" + pct(seg.pct) + ")." : "") : "");
}
iniciarFiltro(qTec.map((t) => t.supervisor), pintar);
pintar();
`,
  otdigital: String.raw`
function pintar() {
  const OD = DATA.otdigital || {}, s = sup(), arr = (OD.tecnicos || []).filter((t) => !s || t.supervisor === s);
  const cu = arr.reduce((a, t) => a + t.cumple, 0), no = arr.reduce((a, t) => a + t.no, 0), tot = cu + no;
  const ptot = (OD.cumple || 0) + (OD.no || 0);
  poner("cards", tarjetasHtml([["Cumplimiento " + (s ? "del equipo" : "COBRA"), tot ? pct(cu / tot) : "—", tot + " órdenes en 30 días"], ["Órdenes que no cumplen", String(no), s ? "equipo de " + s : "de " + tot + " órdenes"], ["Técnicos", String(arr.length), "activos de COBRA"]].concat(!s && ptot ? [["Total en Power BI", pct(OD.cumple / ptot), ptot + " órdenes de COBRA"]] : [])));
  document.getElementById("odExp").textContent = "Órdenes cerradas en los últimos 30 días por técnicos activos de COBRA. Datos del " + fechaDatos + ".";
  const mp = (z) => (z.cumple + z.no) ? z.cumple / (z.cumple + z.no) : 0;
  barras("odAct", (OD.actividades || []).map((z) => ({ n: z.actividad, v: mp(z) })), (v) => pct(v), 1);
  barras("odSem", (OD.semanas || []).map((z) => ({ n: "Semana " + z.semana, v: mp(z) })), (v) => pct(v), 1);
  const cab = '<tr><th>Técnico</th><th class="sup">Supervisor</th><th class="n">Órdenes</th><th class="n">No cumplen</th><th>Cumplimiento</th></tr>';
  const fila = (t) => { const T = t.cumple + t.no, p = mp(t); return '<tr><td class="nom">' + esc(t.nombre) + '</td><td class="sup">' + esc(t.supervisor) + '</td><td class="n">' + T + '</td><td class="n">' + (t.no || "—") + '</td><td><span class="bb" style="display:inline-block;width:90px;vertical-align:middle"><i style="width:' + (100 * p) + '%"></i></span> ' + pct(p) + "</td></tr>"; };
  const ord = arr.slice().sort((a, b) => mp(a) - mp(b));
  document.getElementById("tOd").innerHTML = arr.length ? cab + ord.map(fila).join("") : "<tr><td>Sin técnicos en esta selección.</td></tr>";
  poner("odPie", "Ordenados del menor al mayor cumplimiento.");
  const peor = ord[0];
  poner("lOd", tot ? "<b>Lectura:</b> " + (s ? "el equipo de " + esc(s) : "COBRA") + " cumple <b>" + pct(cu / tot) + "</b> de sus órdenes (" + no + " no cumplen)." + (peor && peor.no ? " El técnico con menor cumplimiento es <b>" + esc(peor.nombre) + "</b> (" + pct(mp(peor)) + ")." : "") : "");
}
iniciarFiltro((DATA.otdigital && DATA.otdigital.tecnicos || []).map((t) => t.supervisor), pintar);
pintar();
`,
};

function pagina({ titulo, sub, volverHref, volverTxt, main, script }) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex">
<title>${titulo} · Cobra</title>
<style>${CSS}</style>
<style>${cssAcademia}</style>
</head><body>
<header class="top"><div class="wrap brand-row"><img src="logo-cobra.png" alt="Cobra"><div class="brand-divider"></div><div class="brand-name">Portal <strong>Supervisor</strong></div><a class="link-portal" id="volver" href="${volverHref}">&larr; ${volverTxt}</a></div></header>
<section class="hero sin-foto"><div class="wrap"><div><p class="eyebrow">Cobra &middot; Claro VTR</p><h1>${titulo}</h1><p class="subtitle">${sub}</p></div></div></section>
<main>${main}</main>
<footer class="foot"><div class="wrap"><span class="by">Diseño y desarrollo <b>J.V.Soft...</b> &middot; <b>SMSI</b> &middot; Construyendo ideas</span></div></footer>
<script>
const DATA = ${JSON.stringify(DATA)};
${script}
activarAnimacion();
(function () { const q = new URLSearchParams(location.search).get("supervisor"); if (q) { document.querySelectorAll("a[data-sup]").forEach((a) => { a.href = a.getAttribute("href").split("?")[0] + "?supervisor=" + encodeURIComponent(q); }); const v = document.getElementById("volver"); if (v && v.getAttribute("href").indexOf("indicadores") === 0) v.href = v.getAttribute("href").split("?")[0] + "?supervisor=" + encodeURIComponent(q); } })();
</script>
</body></html>`;
}

// ---- indice
function claves() { return Object.keys(PAGINAS); }
function cifra(clave) {
  const N = DATA.nps || {}, B = DATA.bloqueos || {}, Q = DATA.qa || {};
  const dec = (x, n) => x.toFixed(n === undefined ? 1 : n).replace(".", ","), pct = (x) => dec(100 * x) + "%";
  if (clave === "nps") return N.inst !== undefined ? [dec(N.inst, 1) + " / " + dec(N.oper, 1), "instalaciones / operaciones"] : ["—", ""];
  if (clave === "bloqueos") { const a = (B.tecnicos || []).filter((t) => t.activo); return [String(a.length), "técnicos con strikes · " + a.filter((t) => t.nivel >= 3).length + " en 3.º o más"]; }
  if (clave === "qa") return Q.resumen ? [pct(Q.resumen.nota), Q.resumen.total + " auditorías"] : ["—", ""];
  if (clave === "otdigital") { const O = DATA.otdigital || {}, T = (O.cumple || 0) + (O.no || 0); return T ? [pct(O.cumple / T), T + " órdenes · 30 días"] : ["—", ""]; }
  return ["—", ""];
}
const EXPL = {
  nps: "Qué tan satisfechos quedan los clientes con la instalación y la reparación.",
  bloqueos: "Técnicos con strikes por incumplir controles y quiénes están cerca de un bloqueo.",
  qa: "Si el técnico sigue el protocolo cuando un auditor lo revisa en la casa del cliente.",
  otdigital: "Si el técnico cierra bien la orden en el sistema, con todos los pasos digitales.",
};
const FICHAS_HTML = '<div class="panel"><h2>Técnicos a mirar primero</h2><p class="exp">Reúne en una sola tabla a los técnicos activos que aparecen en alguno de los controles: strikes, observaciones de auditoría y encuestas de cliente detractor. Parten arriba los de 3.º strike y los que suman más señales.</p><div class="filtro"><label for="sup">Supervisor</label><select id="sup"></select></div><div class="tabla-wrap"><table class="t" id="tFic"></table></div><p class="pie-dato" id="ficPie"></p></div>';
const HUB_JS = String.raw`
function pintar() {
  const s = sup(), arr = (DATA.fichas || []).filter((f) => !s || f.supervisor === s);
  const cab = '<tr><th>Técnico</th><th class="sup">Supervisor</th><th>Strikes</th><th class="n">Auditorías con observación</th><th class="n">Encuestas detractor</th></tr>';
  const cu = arr.map((f) => '<tr><td class="nom">' + esc(f.nombre) + '</td><td class="sup">' + esc(f.supervisor) + '</td><td><span class="chip' + (f.nivel >= 3 ? " o" : "") + '">' + esc(f.strikes || "—") + '</span></td><td class="n">' + (f.obs ? f.obs + " de " + f.audit : "—") + '</td><td class="n">' + (f.detr || "—") + "</td></tr>").join("");
  document.getElementById("tFic").innerHTML = arr.length ? cab + cu : "<tr><td>Sin técnicos en esta selección.</td></tr>";
  poner("ficPie", arr.length + " técnicos. Datos del " + fechaDatos + ". Detalle de cada control en las páginas de abajo.");
}
iniciarFiltro((DATA.fichas || []).map((f) => f.supervisor), pintar);
pintar();
`;
const indiceMain = FICHAS_HTML + '<div class="panel"><h2>Elige un indicador</h2><p class="exp">Cada indicador explica qué mide, cómo leerlo y qué técnicos conviene mirar. Los datos vienen del Power BI y se actualizan cada día.</p><div class="menu">' +
  claves().map((k) => { const c = cifra(k); return '<a class="mcard" data-sup href="' + PAGINAS[k].archivo + '"><span class="mt">' + PAGINAS[k].corto + '</span><span class="mv">' + c[0] + '</span><span class="ms">' + c[1] + '</span><span class="md">' + EXPL[k] + '</span><span class="mg">Ver detalle &rarr;</span></a>'; }).join("") + "</div></div>";

(async () => {
  try {
    await publicarProtegida(pagina({ titulo: "Indicadores de calidad", sub: "NPS, bloqueos, auditorías y OT Digital de COBRA · datos del " + DATA.generado.slice(0, 10).split("-").reverse().join("-") + ".", volverHref: "supervisor.html", volverTxt: "Volver al dashboard", main: indiceMain, script: SHARED + HUB_JS }), "indicadores.html", "indicadores", "Indicadores de calidad");
    for (const k of claves()) {
      const P = PAGINAS[k];
      const script = SHARED + ESPECIFICO[k];
      await publicarProtegida(pagina({ titulo: P.titulo, sub: P.sub, volverHref: "indicadores.html", volverTxt: "Indicadores de calidad", main: cuerpo(k), script }), P.archivo, P.archivo.replace(".html", ""), P.titulo);
    }
    console.log("==> Generadas " + (claves().length + 1) + " paginas: indicadores.html + " + claves().map((k) => PAGINAS[k].archivo).join(", "));
  } catch (e) { console.error("ERROR:", e.message); process.exit(1); }
})();
