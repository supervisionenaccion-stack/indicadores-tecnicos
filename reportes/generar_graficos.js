// Graficos del equipo para supervisores (copia adaptada de los Graficos del
// Portal Supervisor Tigo): calidad contra produccion por tecnico, mes a mes de
// cada indicador, las agencias comparadas y cada tecnico contra su meta.
//
// No consulta la base de datos: usa privado/graficos_datos.json, que deja
// generar_portal.js (cuentas por tecnico y mes, sin RUT).
// Uso: node reportes/generar_graficos.js           -> graficos.html cifrada (+ copia en privado/)
//      node reportes/generar_graficos.js prueba    -> prueba_graficos.html sin cifrar (no se publica)

const fs = require("fs");
const path = require("path");
const { publicarProtegida, DIR_PRIVADO } = require("./proteger.js");

const RAIZ = path.join(__dirname, "..");
const AVISO_PRUEBA = '<div class="aviso-prueba"><b>Página de prueba:</b> no está publicada. Los datos son los reales de la última generación.</div>';

async function main() {
  const prueba = process.argv[2] === "prueba";
  const datosPath = path.join(DIR_PRIVADO, "graficos_datos.json");
  if (!fs.existsSync(datosPath)) throw new Error("falta privado/graficos_datos.json (correr antes generar_portal.js)");
  const data = JSON.parse(fs.readFileSync(datosPath, "utf-8"));

  const html = fs.readFileSync(path.join(RAIZ, "template-graficos.html"), "utf-8")
    .replace("/*__CSS_BASE__*/", () => fs.readFileSync(path.join(__dirname, "estilo-base.css"), "utf-8"))
    .replace("/*__ESTILO_ACADEMIA__*/", () => fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8"))
    .replace("/*__DATA__*/null", () => JSON.stringify(data).replace(/</g, "\\u003c"))
    .replace("<!--__AVISO_PRUEBA__-->", () => (prueba ? AVISO_PRUEBA : ""));

  // Controles antes de escribir: si algo no cuadra no se toca graficos.html
  const errores = [];
  for (const k of ["cal", "der", "rgu", "vec"]) if (!(data.meses[k] || []).length) errores.push(`sin meses de ${k}`);
  if (/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/.test(html) || /"\d{7,8}[\dkK]"/i.test(html)) errores.push("contiene un RUT completo");
  if (!html.trimEnd().endsWith("</html>") || /__DATA__|__ESTILO_ACADEMIA__|__CSS_BASE__/.test(html)) errores.push("plantilla sin reemplazar o HTML cortado");
  if (errores.length) throw new Error("VALIDACION GRAFICOS FALLIDA: " + errores.join(" | "));

  const destino = prueba
    ? (fs.writeFileSync(path.join(RAIZ, "prueba_graficos.html"), html, "utf-8"), path.join(RAIZ, "prueba_graficos.html"))
    : await publicarProtegida(html, "graficos.html", "graficos", "Gráficos del equipo");
  const resumen = Object.entries(data.meses).map(([k, l]) => `${k} ${l.length} meses`).join(", ");
  console.log(`==> Generado: ${destino}`);
  console.log(`    GRAFICOS: ${resumen} | generado ${data.generadoEl}`);
}

main().catch((err) => { console.error("ERROR:", err.message); process.exit(1); });
