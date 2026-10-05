// PRUEBA (no se publica): portal del tecnico con mas detalle de cada orden
// repetida, para que el tecnico reconozca cual fue. Toma el index.html ya
// generado, le suma desde CALIDAD_VTR la direccion, el tipo de trabajo y la
// visita que se repitio (orden, fecha, tipo y nota de cierre), y escribe
// prueba_tecnico.html con las ordenes repetidas en tarjetas.
//
//   node reportes/generar_prueba_repetidos.js
//
// OJO: index.html es publico. Este detalle (direccion del cliente, notas) no
// debe ir al portal publicado tal cual; ver CONTEXTO.md.

const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const { leerEnv } = require("./proteger.js");

const RAIZ = path.join(__dirname, "..");
const RUT_COMPLETO = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;
const limpiar = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(RUT_COMPLETO, "(RUT)");

function leerData(html) {
  const m = html.match(/const DATA = (\{.*?\});\r?\n/s);
  if (!m) throw new Error("index.html: no se encontro el bloque de datos");
  return { data: JSON.parse(m[1]), bloque: m[1] };
}

async function main() {
  const indexHtml = fs.readFileSync(path.join(RAIZ, "index.html"), "utf-8");
  const { data, bloque } = leerData(indexHtml);
  const ordenes = [...new Set(Object.values(data.tecnicos).flatMap((t) => (t.calidad && t.calidad.causas) || []).map((c) => c.ordenTrabajo).filter(Boolean))];
  if (!ordenes.length) throw new Error("no hay ordenes repetidas en index.html");

  const env = leerEnv();
  const pool = await sql.connect({
    server: env.DB_SERVER, port: Number(env.DB_PORT) || 1433, database: env.DB_DATABASE, user: env.DB_USER, password: env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 300000,
  });
  const req = pool.request();
  ordenes.forEach((o, i) => req.input("o" + i, sql.VarChar, o));
  const r = await req.query(`
    SELECT [Orden de Trabajo] AS orden, Direccion, Ciudad, SubtipoPrimerServicio, [Orden Repetido] AS ordenRep,
           Fecha_Cierre_Repetido, TipoActividadRepetido, CodigoCierreRepetido, NotasCierreRepetido, DiasDiferencia
    FROM CALIDAD_VTR
    WHERE EsRepetido30Dias = 1 AND [Orden de Trabajo] IN (${ordenes.map((_, i) => "@o" + i).join(",")})`);
  await pool.close();

  const detalle = new Map();
  for (const f of r.recordset) {
    if (detalle.has(f.orden)) continue;
    detalle.set(f.orden, {
      direccion: limpiar(f.Direccion), ciudad: limpiar(f.Ciudad), subtipo: limpiar(f.SubtipoPrimerServicio),
      ordenRep: limpiar(f.ordenRep), fechaRep: f.Fecha_Cierre_Repetido ? new Date(f.Fecha_Cierre_Repetido).toISOString().slice(0, 10) : null,
      tipoRep: limpiar(f.TipoActividadRepetido), notasRep: limpiar(f.NotasCierreRepetido).slice(0, 400),
    });
  }
  let conDetalle = 0, total = 0;
  for (const t of Object.values(data.tecnicos)) {
    for (const c of (t.calidad && t.calidad.causas) || []) {
      total++;
      const d = detalle.get(c.ordenTrabajo);
      if (d) { Object.assign(c, d); conDetalle++; }
    }
  }

  // Tarjetas en vez de la tabla angosta: una por orden repetida.
  const template = fs.readFileSync(path.join(RAIZ, "index.html"), "utf-8");
  const ini = template.indexOf("  if (datos.causas && datos.causas.length > 0) {");
  const fin = template.indexOf("+ '</tbody></table></div>';", ini);
  if (ini < 0 || fin < 0) throw new Error("no se encontro el bloque de ordenes repetidas en index.html");
  const cierre = template.indexOf("}", fin) + 1;
  const tarjetas = `  if (datos.causas && datos.causas.length > 0) {
    const eventosOrdenados = [...datos.causas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    html += '<p style="margin:14px 0 6px; font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.04em;">Tus órdenes repetidas (' + eventosOrdenados.length + ')</p>';
    html += eventosOrdenados.map((e) => {
      const lugar = [e.direccion, e.ciudad].filter(Boolean).join(', ');
      return '<div class="rep-card">'
        + '<div class="rep-top"><span class="rep-tag">Tu trabajo</span> ' + (e.tipoActividad || 'Orden') + (e.subtipo ? ' · ' + e.subtipo : '') + '</div>'
        + '<div class="rep-linea"><b>' + (e.fecha ? formatFechaLarga(e.fecha) : '—') + '</b> · Orden <b>' + (e.ordenTrabajo || '—') + '</b></div>'
        + (lugar ? '<div class="rep-linea">📍 ' + lugar + '</div>' : '')
        + '<div class="rep-sep">El cliente volvió a pedir visita ' + (e.dias != null ? 'a los <b>' + e.dias + ' día' + (e.dias === 1 ? '' : 's') + '</b>' : '') + '</div>'
        + '<div class="rep-top"><span class="rep-tag rep-tag-r">Repetido</span> ' + (e.tipoRep || 'Visita') + '</div>'
        + '<div class="rep-linea"><b>' + (e.fechaRep ? formatFechaLarga(e.fechaRep) : '—') + '</b>' + (e.ordenRep ? ' · Orden <b>' + e.ordenRep + '</b>' : '') + '</div>'
        + '<div class="rep-linea">Causa: <b>' + e.causa + '</b></div>'
        + (e.notasRep ? '<div class="rep-notas">Nota de cierre: “' + e.notasRep + '”</div>' : '')
        + '</div>';
    }).join('');
  }`;
  const estilo = `  .rep-card{ border:1px solid var(--panel-2); border-left:4px solid var(--bad, #e2523e); border-radius:10px; padding:10px 12px; margin:8px 0; font-size:13px; line-height:1.45; }
  .rep-top{ font-weight:700; color:var(--cobra-navy, #003c71); }
  .rep-linea{ color:var(--text, #22303f); }
  .rep-tag{ display:inline-block; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:1px 7px; border-radius:6px; background:#e6eef8; color:#003c71; }
  .rep-tag-r{ background:#fce4e0; color:#a3301f; }
  .rep-sep{ margin:6px 0; padding:4px 0; border-top:1px dashed var(--panel-2); border-bottom:1px dashed var(--panel-2); color:var(--text-dim); font-size:12.5px; }
  .rep-notas{ margin-top:4px; color:var(--text-dim); font-size:12.5px; font-style:italic; }
`;
  let html = template.slice(0, ini) + tarjetas + template.slice(cierre);
  html = html.replace("  .tabla-repetidos-wrap{", () => estilo + "  .tabla-repetidos-wrap{");
  html = html.replace(bloque, () => JSON.stringify(data).replace(/</g, "\\u003c"));
  if (RUT_COMPLETO.test(html)) throw new Error("la prueba contiene un RUT completo");
  html = html.replace("<title>", "<title>PRUEBA · ");
  fs.writeFileSync(path.join(RAIZ, "prueba_tecnico.html"), html, "utf-8");
  console.log(`==> prueba_tecnico.html: ${conDetalle} de ${total} ordenes repetidas con detalle`);
}

main().catch((err) => { console.error("ERROR:", err.message); process.exit(1); });
