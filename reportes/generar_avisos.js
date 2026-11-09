// Lista de avisos de la campanita del portal tecnico: avisos.json (se publica junto a index.html).
// Une (1) los videos de videos.html del sitio de capacitacion (cada video nuevo = un aviso, solo)
// y (2) los avisos manuales de reportes/avisos_manuales.json (comunicados, cambios, etc.).
// Para avisar de un comunicado nuevo: agregar una linea en avisos_manuales.json y correr este script.
//   { "id": "texto-unico", "fecha": "AAAA-MM-DD", "tipo": "comunicado|video|autochequeo|otro", "titulo": "Texto", "enlace": "https://..." }
// Solo se guardan los avisos de los ultimos 30 dias. Uso: node reportes/generar_avisos.js
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SITIO = "https://supervisionenaccion-stack.github.io/capacitacion-tecnica/";
const VIDEOS_HTML = process.env.AVISOS_VIDEOS_HTML || "C:/Bases_Vtr/capacitacion-vtr/videos.html";
const DIAS = 30;

function videosDelSitio() {
  if (!fs.existsSync(VIDEOS_HTML)) { console.warn("AVISO: no se encontro " + VIDEOS_HTML + "; no se agregan avisos de videos."); return []; }
  const html = fs.readFileSync(VIDEOS_HTML, "utf-8");
  const m = html.match(/var VIDEOS = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error("videos.html: no se encontro la lista VIDEOS");
  const lista = new Function("return " + m[1])();
  return lista.filter((v) => v.id && v.fecha).map((v) => ({
    id: "video-" + v.id,
    fecha: v.fecha,
    tipo: "video",
    titulo: "Nuevo video de armado del conector" + (v.tecnico ? ": " + v.tecnico : "") + (v.region ? " (" + v.region + ")" : ""),
    enlace: SITIO + "videos.html",
  }));
}

const manuales = JSON.parse(fs.readFileSync(path.join(__dirname, "avisos_manuales.json"), "utf-8"));
const limite = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);
const todos = [...videosDelSitio(), ...manuales];
const vistos = new Set();
const avisos = todos
  .filter((a) => a.id && a.fecha && a.titulo && a.fecha >= limite && !vistos.has(a.id) && vistos.add(a.id))
  .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
fs.writeFileSync(path.join(RAIZ, "avisos.json"), JSON.stringify({ avisos }, null, 1), "utf-8");
console.log(`==> avisos.json: ${avisos.length} avisos (ultimos ${DIAS} dias)`);
