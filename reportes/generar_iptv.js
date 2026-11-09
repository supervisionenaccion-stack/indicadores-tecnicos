// "Calidad de instalacion IPTV" para el portal del supervisor. Se publica cifrada como
// iptv.html (boton en supervisor.html); la copia sin cifrar queda en privado/. Los datos los deja el flujo en Python
// (C:\Bases_Vtr\Informe_Ranking_IPTV\Envios\iptv_datos.json: por tecnico, sin RUT).
// Otra ruta del JSON: IPTV_DATOS en el entorno.
const fs = require("fs");
const path = require("path");
const { publicarProtegida } = require("./proteger.js");

const JSON_DEFECTO = "C:\\Bases_Vtr\\Informe_Ranking_IPTV\\Envios\\iptv_datos.json";
const archivo = process.env.IPTV_DATOS || JSON_DEFECTO;
if (!fs.existsSync(archivo)) { console.error("ERROR: no encuentro", archivo); process.exit(1); }
const DATA = JSON.parse(fs.readFileSync(archivo, "utf-8"));
const css = fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8");

const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex">
<title>Calidad de instalación IPTV · Cobra</title>
<style>
:root{ --bg:#eef1f4; --panel:#fff; --border:#e0e5ea; --text:#22303f; --dim:#6b7a8c; --navy:#003c71; --blue:#0071ce; }
*{box-sizing:border-box;} body{ margin:0; font-family:'Segoe UI',Arial,sans-serif; background:var(--bg); color:var(--text); }
.aviso-prueba{ background:#fdf1e2; color:#8a5a12; font-weight:700; font-size:13px; text-align:center; padding:8px 16px; border-bottom:1px solid #e2962e; }
.brand-row{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; } .brand-row img{ height:36px; } .brand-divider{ width:1px; height:28px; background:var(--border); }
.link-portal{ color:var(--blue); font-weight:700; font-size:13px; text-decoration:none; }
main{ padding:24px clamp(16px,3vw,56px) 60px; max-width:1400px; margin:0 auto; }
main .panel{ background:#fff; border:1px solid var(--border); border-top:3px solid var(--navy); border-radius:12px; padding:18px 20px; margin-bottom:18px; }
main .panel h2{ margin:0 0 4px; font-size:13px; letter-spacing:.12em; text-transform:uppercase; color:var(--blue); font-weight:800; }
main .panel .exp{ margin:0 0 14px; font-size:13px; color:var(--dim); }
.filtro{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
.filtro label{ font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.filtro select{ font:inherit; font-size:14px; padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:#fff; color:var(--text); min-width:220px; }
.cards{ display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
.card{ border:1px solid var(--border); border-radius:10px; padding:12px 14px; background:#fff; }
.card .k{ font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.card .v{ font-size:30px; font-weight:800; color:var(--navy); line-height:1.15; margin-top:4px; }
.card .s{ font-size:12px; color:var(--dim); margin-top:2px; }
.tabla-wrap{ overflow-x:auto; }
table.t{ width:100%; border-collapse:collapse; font-size:14px; }
table.t th{ background:var(--navy); color:#fff; font-size:12px; font-weight:700; padding:10px 12px; text-align:right; white-space:nowrap; cursor:pointer; user-select:none; }
table.t th:first-child, table.t th:nth-child(2), table.t th:nth-child(3){ text-align:left; } #tablaPbi th:nth-child(2), #tablaPbi th:nth-child(3){ text-align:right; }
table.t th.act::after{ content:" \\25BE"; } table.t th.asc::after{ content:" \\25B4"; }
table.t td{ padding:9px 12px; border-bottom:1px solid var(--border); text-align:right; white-space:nowrap; }
table.t td:first-child, table.t td:nth-child(2), table.t td:nth-child(3){ text-align:left; } #tablaPbi td:nth-child(2), #tablaPbi td:nth-child(3){ text-align:right; color:inherit; font-size:14px; }
table.t td.n{ color:var(--dim); width:34px; } table.t td.nom{ font-weight:700; color:var(--text); }
table.t td.cau{ font-size:12.5px; color:var(--dim); text-align:left; white-space:normal; min-width:150px; }
table.t td.sup{ color:var(--dim); font-size:13px; }
table.t td.em{ font-weight:800; color:var(--navy); }
table.t tr.poco td{ color:#98a4b3; } table.t tr.poco td.em{ color:#98a4b3; font-weight:700; }
table.t tr.tot td{ background:#f3f5f8; font-weight:800; border-top:2px solid var(--navy); }
.barra{ display:inline-block; vertical-align:middle; width:70px; height:8px; background:#e6ebf0; border-radius:4px; margin-left:8px; overflow:hidden; }
.barra i{ display:block; height:100%; background:var(--navy); }
.rv{ opacity:0; transform:translateY(22px); }
.rv.rv-ver{ opacity:1; transform:none; transition:opacity .95s ease, transform .95s cubic-bezier(.2,.7,.2,1); }
.card{ animation:entra .8s cubic-bezier(.2,.7,.2,1) both; } .card:nth-child(2){ animation-delay:.12s; } .card:nth-child(3){ animation-delay:.24s; } .card:nth-child(4){ animation-delay:.36s; }
@keyframes entra{ from{ opacity:0; transform:translateY(16px); } to{ opacity:1; transform:none; } }
table.t tr:not(:first-child){ animation:fila .6s ease both; }
@keyframes fila{ from{ opacity:0; transform:translateX(-10px); } to{ opacity:1; transform:none; } }
.barra i{ transform-origin:left center; animation:crece 1.6s cubic-bezier(.2,.7,.2,1) .3s both; }
@keyframes trazo{ from{ stroke-dashoffset:1; } to{ stroke-dashoffset:0; } }
@keyframes crece{ from{ transform:scaleX(0); } to{ transform:scaleX(1); } }
.rv:not(.rv-ver) :is(.barra i,table.t tr){ animation-play-state:paused; }
@media (prefers-reduced-motion:reduce){ .rv{ opacity:1; transform:none; } .card,table.t tr,.barra i{ animation:none!important; } }
@media print{ .rv{ opacity:1!important; transform:none!important; } }
table.pb{ font-size:13px; } table.pb th{ text-transform:none; letter-spacing:0; background:#f3f5f8; color:var(--text); font-size:12px; font-weight:700; padding:8px 10px; border-bottom:2px solid var(--navy); white-space:normal; vertical-align:bottom; }
table.pb th.act::after{ content:" \\25BE"; } table.pb th.asc::after{ content:" \\25B4"; }
table.pb td{ padding:7px 10px; border-bottom:1px solid #e6ebf0; white-space:nowrap; } table.pb td.nom{ font-weight:600; } table.pb td.sup{ font-size:12.5px; color:var(--dim); }
table.pb tr.tot td{ background:#f3f5f8; font-weight:800; border-top:2px solid var(--navy); } table.pb td.cau{ font-size:12.5px; } table.pb td.nom, table.pb td.sup{ white-space:nowrap; }
.mb{ display:inline-block; vertical-align:middle; width:90px; height:8px; background:#eef1f4; border-radius:4px; margin-left:8px; overflow:hidden; } .mb i{ display:block; height:100%; background:#1f3a5f; border-radius:4px; transform-origin:left center; animation:crece 1.6s cubic-bezier(.2,.7,.2,1) .3s both; }
.mb.ia i{ background:#7f9bb8; } table.pb td:has(.mb){ white-space:nowrap; text-align:right; } table.pb td:has(.mb) .mb{ margin-left:8px; }
.sb{ display:flex; height:7px; border-radius:4px; overflow:hidden; background:#eef1f4; margin-top:4px; min-width:120px; } .sb i{ display:block; height:100%; transform-origin:left center; animation:crece 1.6s cubic-bezier(.2,.7,.2,1) .3s both; }
.leyenda{ display:flex; gap:14px; flex-wrap:wrap; font-size:12px; color:var(--dim); margin:0 0 10px; } .leyenda span::before{ content:""; display:inline-block; width:10px; height:10px; border-radius:2px; background:var(--k); margin-right:5px; vertical-align:-1px; }
.ex3{ display:grid; grid-template-columns:1fr 1fr; gap:22px 28px; } .exb h3{ margin:0 0 10px; font-size:13px; font-weight:800; color:var(--text); } .exb.ancho{ grid-column:1 / -1; }
.exl{ display:flex; gap:14px; flex-wrap:wrap; font-size:12px; color:var(--dim); margin-top:6px; } .exl span::before{ content:""; display:inline-block; width:10px; height:10px; border-radius:2px; background:var(--k); margin-right:5px; vertical-align:-1px; }
.hb{ display:grid; grid-template-columns:150px 1fr 56px; align-items:center; gap:10px; font-size:12.5px; margin:5px 0; } .hb .nm{ color:var(--text); } .hb .bb{ height:10px; background:#eef1f4; border-radius:5px; overflow:hidden; } .hb .bb i{ display:block; height:100%; border-radius:5px; background:#a9b8c8; transform-origin:left center; animation:crece 1.6s cubic-bezier(.2,.7,.2,1) .3s both; } .hb.yo .bb i{ background:#1f3a5f; } .hb.yo .nm, .hb.yo .vl{ font-weight:800; color:var(--navy); } .hb .vl{ text-align:right; color:var(--dim); font-variant-numeric:tabular-nums; }
.rv:not(.rv-ver) .hb .bb i{ animation-play-state:paused; }
@media (max-width:760px){ .ex3{ grid-template-columns:1fr; } .hb{ grid-template-columns:110px 1fr 50px; } }
table.pb tr:hover td{ background:#f7f9fb; } table.pb tr.tot:hover td{ background:#f3f5f8; }
.card .v{ font-size:22px; }
@media (max-width:700px){ table.pb td.sup, table.pb th:nth-child(3){ display:none; } table.pb td, table.pb td.cau{ white-space:normal; padding:6px 5px; } table.pb td.nom{ min-width:0; } table.pb td:has(.mb){ white-space:nowrap; } .mb{ width:38px; margin-left:5px; } .mb.ia{ display:none; } .sb{ min-width:70px; } table.pb th{ padding:6px 5px; font-size:11px; } table.pb{ font-size:12px; } }
.tag{ display:inline-block; font-size:10px; font-weight:700; color:#6b7a8c; background:#eef1f4; border-radius:4px; padding:1px 6px; margin-left:6px; }
table.t{ font-size:12.5px; } table.t th{ white-space:normal; font-size:11px; line-height:1.2; padding:7px 4px; vertical-align:bottom; } table.t td{ padding:6px 4px; white-space:normal; }
table.t td.nom{ min-width:0; max-width:none; } table.t td.sup{ font-size:11.5px; } table.t td.cau{ font-size:11.5px; white-space:nowrap; } #tablaPbi td:nth-child(2), #tablaPbi td:nth-child(3){ font-size:12.5px; }
.barra{ width:28px; margin-left:4px; } .tag{ display:block; margin:2px 0 0; width:max-content; }
@media (max-width:700px){ table.t{ font-size:12px; } table.t td.sup{ display:none; } table.t th:nth-child(3):not(#tablaPbi th){ display:none; } }
.nota{ font-size:13px; color:#4b5563; line-height:1.5; margin:0 0 8px; } .nota b{ color:var(--navy); }
.pie-dato{ font-size:12px; color:var(--dim); margin-top:10px; }
@media (max-width:520px){ .filtro select{ min-width:0; width:100%; } .card .v{ font-size:26px; } }
</style>
<style>${css}</style>
</head><body>
<header class="top"><div class="wrap brand-row"><img src="logo-cobra.png" alt="Cobra"><div class="brand-divider"></div><div class="brand-name">Portal <strong>Supervisor</strong></div><a class="link-portal" href="supervisor.html">&larr; Volver al dashboard</a></div></header>
<section class="hero sin-foto"><div class="wrap"><div><p class="eyebrow">Cobra &middot; Claro VTR</p><h1>Calidad de instalación <b>IPTV</b></h1><p class="subtitle" id="sub"></p></div></div></section>
<main>
  <div class="panel">
    <h2>Resumen</h2>
    <div class="filtro"><label for="sup">Supervisor</label><select id="sup"></select></div>
    <div class="cards" id="cards"></div>
  </div>
  <div class="panel">
    <h2>Técnicos</h2>
    <p class="exp">Cantidades de la revisión, como en el Power BI. Toca un encabezado para ordenar.</p>
    <p class="leyenda" id="ley"></p>
    <div class="tabla-wrap"><table class="t pb" id="tabla"></table></div>
    <p class="pie-dato" id="pie"></p>
  </div>
  <div class="panel" id="panelExtra" style="display:none">
    <h2>Tendencia y comparación</h2>
    <p class="exp">Gráficos del Power BI: cómo evolucionó COBRA por semana, cómo está frente a las otras empresas y en qué tipo de instalación se falla más.</p>
    <div class="ex3">
      <div class="exb"><h3>Evolución semanal COBRA</h3><div id="exSem"></div><div class="exl"><span style="--k:#1f3a5f">% decos bien instalados</span><span style="--k:#7f9bb8">% instalaciones correctas</span></div></div>
      <div class="exb"><h3>Instalaciones correctas según cantidad de decos</h3><div id="exTramo"></div></div>
      <div class="exb ancho"><h3>Empresas contra la meta (brecha en puntos)</h3><div id="exEmp"></div></div>
    </div>
  </div>
  <div class="panel">
    <h2>Igual al Power BI</h2>
    <p class="exp">La misma tabla "Ranking de técnicos" del Power BI (EPS COBRA, IPTV, semanas vigentes), con las mismas columnas, cifras y formato. Incluye a los técnicos dados de baja, por eso el total coincide con el del Power BI.</p>
    <div class="tabla-wrap"><table class="t" id="tablaPbi"></table></div>
    <p class="pie-dato">Brecha vs meta: puntos porcentuales respecto de la meta de ${DATA.meta}%.</p>
  </div>
  <div class="panel">
    <h2>Cómo leer esta tabla</h2>
    <p class="nota"><b>Instalaciones:</b> visitas que se revisaron al día siguiente. Una instalación queda <b>con equipos defectuosos</b> si al menos un deco quedó mal.</p>
    <p class="nota"><b>Decos:</b> cada decodificador se cuenta por separado. Está <b>bien</b> si tiene buena señal Wi-Fi (RSSI de -58 dBm o mejor) y está en 5G. Está <b>mal</b> si la señal es más débil, está en 2.4G o no tiene lectura. La meta es que el 96% de los decos quede bien.</p>
    <p class="nota">Un técnico puede verse mejor en el porcentaje de instalaciones que en el de decos, y al revés. Por eso se muestran los dos, junto con las cantidades.</p>
    <p class="nota"><b>Alcance:</b> esta página mide solo los decodificadores de IPTV. El Power BI también certifica la potencia óptica de los ONT de fibra y los extensores Wi-Fi, que aquí no se muestran.</p>
    <p class="nota"><b>Actualización:</b> la medición es del día siguiente a la instalación y el Power BI se recalcula durante el día. Las cifras de la semana más reciente pueden variar un poco al día siguiente.</p>
  </div>
</main>
<footer class="foot"><div class="wrap"><span class="by">Diseño y desarrollo <b>J.V.Soft...</b> &middot; <b>SMSI</b> &middot; Construyendo ideas</span></div></footer>
<script>
const DATA = ${JSON.stringify(DATA)};
const META = DATA.meta, MINACT = DATA.minAct;
const f1 = (x) => x.toFixed(1).replace(".", ",") + "%";
const num = (x) => String(x).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const filas = DATA.tecnicos.map((t) => Object.assign({}, t, {
  pDef: 100 * t.actMal / t.act, pBien: 100 * (t.eq - t.eqMal) / t.eq, pMal: 100 * t.eqMal / t.eq,
  poco: t.act < MINACT,
}));
const COLS = [
  { k: "nombre", t: "Técnico", txt: true }, { k: "supervisor", t: "Supervisor", txt: true },
  { k: "act", t: "Instalaciones" }, { k: "actMal", t: "Con equipos defectuosos" },
  { k: "eq", t: "Decos revisados" }, { k: "eqMal", t: "Decos mal instalados" },
  { k: "causaTxt", t: "Causa principal de falla", txt: true },
];
const CN = DATA.causasNombres || {};
const CORTO = { "2.4G": "Conectado 2.4G", RSSI: "Señal baja", AMBAS: "Señal + 2.4G", SIN_LECTURA: "Sin lectura" };
function causaTxt(c) {   // causa más frecuente y detalle completo
  const e = Object.entries(c || {}).sort((a, b) => b[1] - a[1]);
  if (!e.length) return { top: "", det: "", lin: "" };
  return { top: (CORTO[e[0][0]] || e[0][0]) + " (" + e[0][1] + ")", det: e.map((x) => (CN[x[0]] || x[0]) + ": " + x[1]).join(" · "), lin: e.map((x) => (CORTO[x[0]] || x[0]) + ": " + x[1]).join(" · ") };
}
filas.forEach((f) => { const c = causaTxt(f.causas); f.causaTxt = c.top; f.causaDet = c.det; });
const COLC = { "2.4G": "#7f9bb8", RSSI: "#1f3a5f", AMBAS: "#4d6d93", SIN_LECTURA: "#c3ccd6" };
const maxAct = Math.max.apply(null, filas.map((f) => f.act)) || 1, maxMal = Math.max.apply(null, filas.map((f) => f.eqMal)) || 1;
function barraCausas(c) {
  const e = Object.entries(c || {}).filter((x) => x[1] > 0), tot = e.reduce((a, x) => a + x[1], 0);
  if (!tot) return "";
  return '<div class="sb">' + e.map((x) => '<i title="' + esc((CN[x[0]] || x[0]) + ": " + x[1]) + '" style="width:' + (100 * x[1] / tot) + '%;background:' + COLC[x[0]] + '"></i>').join("") + "</div>";
}
document.getElementById("ley").innerHTML = Object.keys(COLC).map((k) => '<span style="--k:' + COLC[k] + '">' + esc(CN[k] || k) + "</span>").join("") + '<span style="--k:#1f3a5f">Las barras comparan cantidades entre técnicos</span>';
let orden = { k: "eqMal", asc: false };
const sel = document.getElementById("sup");
sel.innerHTML = '<option value="">Todos los supervisores</option>' + Array.from(new Set(filas.map((f) => f.supervisor))).sort().map((s) => '<option>' + esc(s) + '</option>').join("");
const _qs = new URLSearchParams(location.search).get("supervisor"); if (_qs && Array.from(sel.options).some((o) => o.value === _qs)) sel.value = _qs;
document.getElementById("sub").textContent = "Semanas " + DATA.semanas + " (acumulado de las semanas vigentes) · datos del " + DATA.exportado + " · revisión al día siguiente de cada instalación.";

function total(arr) {
  const t = { act: 0, actMal: 0, eq: 0, eqMal: 0 };
  arr.forEach((f) => { t.act += f.act; t.actMal += f.actMal; t.eq += f.eq; t.eqMal += f.eqMal; });
  t.pDef = t.act ? 100 * t.actMal / t.act : 0; t.pBien = t.eq ? 100 * (t.eq - t.eqMal) / t.eq : 0; t.pMal = 100 - t.pBien;
  return t;
}
function pintar() {
  const arr = filas.filter((f) => !sel.value || f.supervisor === sel.value);
  const t = sel.value ? total(arr) : (function () { const b = Object.assign({}, DATA.total); b.pDef = 100 * b.actMal / b.act; b.pBien = 100 * (b.eq - b.eqMal) / b.eq; b.pMal = 100 - b.pBien; return b; })();   // todos: total igual al Power BI
  document.getElementById("cards").innerHTML = [
    ["Instalaciones revisadas", num(t.act), arr.length + " técnicos en la lista"],
    ["Con equipos defectuosos", num(t.actMal), "al menos un deco mal"],
    ["Decos revisados", num(t.eq), "equipos revisados"],
    ["Decos mal instalados", num(t.eqMal), "decos fuera de norma"],
  ].map((c) => '<div class="card"><div class="k">' + c[0] + '</div><div class="v">' + c[1] + '</div><div class="s">' + c[2] + '</div></div>').join("");
  const ord = arr.slice().sort((a, b) => {
    const x = a[orden.k], y = b[orden.k];
    const r = (typeof x === "string") ? String(x).localeCompare(String(y), "es") : x - y;
    return (orden.asc ? r : -r) || a.nombre.localeCompare(b.nombre, "es");
  });
  const sumC = (lst) => lst.reduce((a, f) => { Object.entries(f.causas || {}).forEach((x) => { a[x[0]] = (a[x[0]] || 0) + x[1]; }); return a; }, {});
  const cab = '<tr><th>#</th>' + COLS.map((c) => '<th data-k="' + c.k + '" class="' + (orden.k === c.k ? (orden.asc ? "asc" : "act") : "") + '" style="text-align:' + (c.txt ? "left" : "right") + '">' + c.t + '</th>').join("") + '</tr>';
  const cuerpo = ord.map((f, i) => '<tr><td class="n">' + (i + 1) + '</td><td class="nom">' + esc(f.nombre) + '</td><td class="sup">' + esc(f.supervisor) + '</td><td>' + f.act + '</td><td>' + f.actMal + '<span class="mb ia"><i style="width:' + (100 * f.actMal / maxAct) + '%"></i></span></td><td>' + f.eq + '</td><td>' + f.eqMal + '<span class="mb"><i style="width:' + (100 * f.eqMal / maxMal) + '%"></i></span></td><td class="cau" title="' + esc(f.causaDet) + '">' + esc(f.causaTxt) + barraCausas(f.causas) + '</td></tr>').join("");
  const fin = '<tr class="tot"><td></td><td>Total' + (sel.value ? " " + esc(sel.value) : " COBRA") + '</td><td></td><td>' + num(t.act) + '</td><td>' + num(t.actMal) + '</td><td>' + num(t.eq) + '</td><td>' + num(t.eqMal) + '</td><td class="cau" style="white-space:normal;min-width:120px">' + esc(causaTxt(sumC(sel.value ? arr : arr.concat(DATA.bajas || []))).lin) + barraCausas(sumC(sel.value ? arr : arr.concat(DATA.bajas || []))) + '</td></tr>';
  document.getElementById("tabla").innerHTML = cab + cuerpo + fin;
  document.getElementById("pie").textContent = (sel.value ? "" : "El total COBRA es el del Power BI e incluye a técnicos dados de baja, por eso puede ser mayor que la suma de la lista. ") + "Generado el " + DATA.generado + ".";
  document.querySelectorAll("#tabla th[data-k]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.k;
    orden = { k: k, asc: orden.k === k ? !orden.asc : COLS.find((c) => c.k === k).txt };
    pintar();
  }));
}

const pc2 = (x) => x.toFixed(2).replace(".", ",") + " %";
const br2 = (x) => (x < 0 ? "-" : "") + Math.abs(x).toFixed(2).replace(".", ",");
function pintarPbi() {
  const todos = DATA.tecnicos.map((t) => Object.assign({ baja: false }, t)).concat((DATA.bajas || []).map((t) => Object.assign({ baja: true }, t)));
  const arr = todos.filter((f) => !sel.value || f.supervisor === sel.value);
  arr.forEach((f) => { f.pI = 100 * (f.act - f.actMal) / f.act; f.pE = 100 * (f.eq - f.eqMal) / f.eq; });
  arr.sort((a, b) => b.pE - a.pE || a.nombre.localeCompare(b.nombre, "es"));
  const T = { act: 0, actMal: 0, eq: 0, eqMal: 0 };
  arr.forEach((f) => { T.act += f.act; T.actMal += f.actMal; T.eq += f.eq; T.eqMal += f.eqMal; });
  const tot = sel.value ? T : DATA.total;
  const pI = tot.act ? 100 * (tot.act - tot.actMal) / tot.act : 0, pE = tot.eq ? 100 * (tot.eq - tot.eqMal) / tot.eq : 0;
  const cab = "<tr><th>Nombre Técnico</th><th>Q Actividades</th><th>Q Actividades Fuera de Norma</th><th>% Instalaciones Correctas</th><th>Brecha vs Meta pp instalaciones</th><th>Q Equipos</th><th>Q Equipos Fuera de Norma</th><th>% Equipos Bien Instalados</th><th>Brecha vs Meta pp equipos</th></tr>";
  const cuerpo = arr.map((f) => '<tr><td class="nom">' + esc(f.nombre) + (f.baja ? '<span class="tag">BAJA</span>' : "") + "</td><td>" + f.act + "</td><td>" + f.actMal + "</td><td>" + pc2(f.pI) + "</td><td>" + br2(f.pI - META) + "</td><td>" + f.eq + "</td><td>" + f.eqMal + "</td><td>" + pc2(f.pE) + "</td><td>" + br2(f.pE - META) + "</td></tr>").join("");
  const fin = '<tr class="tot"><td>Total</td><td>' + tot.act + "</td><td>" + tot.actMal + "</td><td>" + pc2(pI) + "</td><td>" + br2(pI - META) + "</td><td>" + tot.eq + "</td><td>" + tot.eqMal + "</td><td>" + pc2(pE) + "</td><td>" + br2(pE - META) + "</td></tr>";
  document.getElementById("tablaPbi").innerHTML = cab + cuerpo + fin;
}
sel.addEventListener("change", function () { pintar(); pintarPbi(); contarCards(); });
pintar();
pintarPbi();
// Gráficos extra del Power BI (evolución semanal, instalaciones por cantidad de decos, empresas contra la meta)
(function () {
  const X = DATA.extras || {};
  if (!X.semanal && !X.tramos && !X.empresas) return;
  document.getElementById("panelExtra").style.display = "";
  const c1 = (x) => x.toFixed(1).replace(".", ",") + "%";
  if (X.semanal && X.semanal.length) {
    const W = 520, H = 190, L = 46, R = 30, T = 18, B = 26, lo = 62, hi = 94, n = X.semanal.length;
    const px = (i) => L + (n > 1 ? i * (W - L - R) / (n - 1) : 0), py = (v) => T + (hi - v) * (H - T - B) / (hi - lo);
    let g = "";
    [70, 80, 90].forEach((v) => { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + py(v) + '" y2="' + py(v) + '" stroke="#e6ebf0"/><text x="' + (L - 6) + '" y="' + (py(v) + 4) + '" text-anchor="end" font-size="11" fill="#6b7a8c">' + v + '%</text>'; });
    [["eq", "#1f3a5f"], ["inst", "#7f9bb8"]].forEach((k) => {
      const pts = X.semanal.map((d, i) => px(i) + "," + py(d[k[0]])).join(" ");
      g += '<polyline points="' + pts + '" fill="none" stroke="' + k[1] + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" pathLength="1" style="stroke-dasharray:1;animation:trazo 1.8s ease .3s both"/>';
      X.semanal.forEach((d, i) => { g += '<circle cx="' + px(i) + '" cy="' + py(d[k[0]]) + '" r="3.2" fill="' + k[1] + '"/><text x="' + px(i) + '" y="' + (py(d[k[0]]) + -8) + '" text-anchor="middle" font-size="11" fill="#33414f">' + c1(d[k[0]]) + '</text>'; });
    });
    X.semanal.forEach((d, i) => { g += '<text x="' + px(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="#6b7a8c">' + esc(d.sem) + '</text>'; });
    document.getElementById("exSem").innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Evolución semanal COBRA">' + g + "</svg>";
  }
  if (X.tramos) {
    document.getElementById("exTramo").innerHTML = X.tramos.map((d) => '<div class="hb"><span class="nm">' + esc(d.tramo) + (d.tramo === "1" ? " deco" : " decos") + '</span><span class="bb"><i style="width:' + d.inst + '%"></i></span><span class="vl">' + c1(d.inst) + "</span></div>").join("") + '<p class="pie-dato">Porcentaje de instalaciones correctas según cuántos decos se instalaron. A más decos, más difícil que todos queden bien.</p>';
  }
  if (X.empresas) {
    const mx = Math.max.apply(null, X.empresas.map((d) => Math.abs(d.brecha)));
    document.getElementById("exEmp").innerHTML = X.empresas.map((d) => '<div class="hb' + (d.eps === "COBRA" ? " yo" : "") + '"><span class="nm">' + esc(d.eps) + '</span><span class="bb"><i style="width:' + (100 * Math.abs(d.brecha) / mx) + '%"></i></span><span class="vl">' + d.brecha.toFixed(1).replace(".", ",") + "</span></div>").join("") + '<p class="pie-dato">Puntos bajo la meta de ' + META + '%: mientras más corta la barra, más cerca de la meta.</p>';
  }
})();
// Animaciones (igual que el dashboard): los bloques aparecen al bajar, las cifras suben y las barras se llenan.
const SIN_MOV = !("IntersectionObserver" in window) || !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function contarCards() {
  if (SIN_MOV) return;
  document.querySelectorAll("#cards .v").forEach(function (el) {
    const fin = parseInt(el.textContent.replace(/\./g, ""), 10);
    if (isNaN(fin)) return;
    const t0 = performance.now();
    (function paso(t) {
      const a = Math.min(1, (t - t0) / 1300), e = 1 - Math.pow(1 - a, 3);
      el.textContent = num(Math.round(fin * e));
      if (a < 1) requestAnimationFrame(paso);
    })(t0);
  });
}
contarCards();
document.querySelectorAll("main .panel").forEach(function (p, i) {
  if (SIN_MOV) return;
  p.classList.add("rv");
  const o = new IntersectionObserver(function (en) { if (en.some(function (x) { return x.isIntersecting; })) { o.disconnect(); p.classList.add("rv-ver"); } }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  o.observe(p);
});
</script>
</body></html>`;
publicarProtegida(html, "iptv.html", "iptv", "Calidad de instalación IPTV").then(() => console.log("==> Generado iptv.html:", DATA.tecnicos.length, "tecnicos,", DATA.semanas)).catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
