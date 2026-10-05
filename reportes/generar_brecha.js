// Brecha a la meta de Produccion RGU para supervisores: cuanto le falta a cada
// tecnico y cuanto necesita por dia para cerrar el mes en 100 %. Se publica
// cifrada como brecha.html (boton en supervisor.html), detras del ingreso de
// supervisores; la copia sin cifrar queda en privado/.
//
// No consulta la base de datos: usa el RGU por tecnico (con su brecha ya
// calculada por reportes/brecha.js) que generar_portal.js dejo en
// privado/supervisor.html, asi da lo mismo que el portal del tecnico.
// Uso: node reportes/generar_brecha.js   (despues de generar_portal.js)

const fs = require("fs");
const path = require("path");
const { publicarProtegida, leerSinCifrar } = require("./proteger.js");
const { calendarioMes, RGU_DIARIO_ALCANZABLE } = require("./brecha.js");

async function main() {
  const html0 = leerSinCifrar("supervisor.html");
  const m = html0.match(/const DATA = (\{.*?\});\r?\n/s);
  if (!m) throw new Error("supervisor.html: no se encontro el bloque de datos (correr antes generar_portal.js)");
  const data = JSON.parse(m[1]);

  const tecnicos = data.tecnicos.filter((t) => t.rgu && t.rgu.brecha).map((t) => ({
    nombre: t.nombre,
    agencia: t.agencia,
    supervisor: t.supervisor,
    rgu: t.rgu.rguCompletadaGsa,
    dias: t.rgu.diasTrabajados,
    metaDiaria: t.rgu.metaDiaria,
    ...t.rgu.brecha,
  }));
  const salida = {
    generadoEl: data.generadoEl,
    periodo: data.periodoMatriz,
    calendario: calendarioMes(data.periodoMatriz),
    rguDiarioAlcanzable: RGU_DIARIO_ALCANZABLE,
    tecnicos,
  };

  const plantilla = fs.readFileSync(path.join(__dirname, "plantilla-brecha.html"), "utf-8");
  const estiloAcademia = fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8");
  const html = plantilla
    .replace("/*__ESTILO_ACADEMIA__*/", () => estiloAcademia)
    .replace("__DATA_BRECHA_JSON__", () => JSON.stringify(salida).replace(/</g, "\\u003c"));

  // Controles antes de escribir: si algo no cuadra no se toca brecha.html
  const errores = [];
  if (!tecnicos.length) errores.push("0 tecnicos con brecha");
  if (/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/.test(html)) errores.push("contiene un RUT completo");
  if (!html.trimEnd().endsWith("</html>") || html.includes("__DATA_BRECHA_JSON__") || html.includes("__ESTILO_ACADEMIA__")) errores.push("plantilla sin reemplazar o HTML cortado");
  if (errores.length) throw new Error("VALIDACION BRECHA FALLIDA: " + errores.join(" | "));

  const destino = await publicarProtegida(html, "brecha.html", "brecha", "Brecha a la meta RGU");
  const bajo = tecnicos.filter((t) => t.pct < 100);
  console.log(`==> Generado: ${destino}`);
  console.log(`    BRECHA: ${tecnicos.length} tecnicos | ${data.periodoMatriz} | quedan ${salida.calendario.restantes} dias habiles | bajo la meta ${bajo.length}`);
}

main().catch((err) => { console.error("ERROR:", err.message); process.exit(1); });
