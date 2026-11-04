// "Recursos del equipo": videos y fotos de los tecnicos. Se publica cifrada
// como recursos.html (boton en supervisor.html); la copia sin cifrar queda en privado/.
// Para agregar algo nuevo: copiar una linea de VIDEOS o FOTOS y cambiar los datos.
// En VIDEOS, "obs" (opcional) muestra una observacion destacada en la tarjeta.
// Los videos y fotos viven en el sitio de capacitacion; aca solo se enlazan.
const fs = require("fs");
const path = require("path");
const { publicarProtegida } = require("./proteger.js");

const SITIO = "https://supervisionenaccion-stack.github.io/capacitacion-tecnica/";
const VIDEOS = [
  { titulo: "Armado del conector", tecnico: "Tomas Ponce", region: "Quinta región", fecha: "2026-10-30", id: "1241466378", foto: "fotos/video_1241466378.jpg", obs: "Insertó la rosca antes de cerrar el seguro" },
  { titulo: "Armado del conector", tecnico: "Andres Rodriguez", region: "RM", fecha: "2026-11-02", id: "1242463711", foto: "fotos/video_1242463711.jpg" },
  { titulo: "Armado del conector", tecnico: "Dario Chambe", region: "Arica", fecha: "2026-11-03", id: "1242812804", foto: "fotos/video_1242812804.jpg", obs: "Olvidó usar OneClick (limpieza del conector)" },
  { titulo: "Armado del conector", tecnico: "Benjamin Perez", region: "RM", fecha: "2026-11-03", id: "1243031055", foto: "fotos/video_1243031055.jpg", obs: "Sopló las herramientas de precisión; no se debe, porque quedan con partículas (equivale a tocarlas con los dedos)" },
  { titulo: "Armado del conector", tecnico: "Eudis Aldama", region: "RM", fecha: "2026-11-04", id: "1243423780", foto: "fotos/video_1243423780.jpg" },
  { titulo: "Armado del conector", tecnico: "Carlos Plazo", region: "Quinta región", fecha: "2026-11-04", id: "1243423482", foto: "fotos/video_1243423482.jpg" },
];
const FOTOS = [
  // { titulo: "Texto de la foto", foto: "fotos/archivo.jpg" },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dmy = (iso) => iso.split("-").reverse().join("-");
const css = fs.readFileSync(path.join(__dirname, "estilo-academia.css"), "utf-8");

const videos = VIDEOS.map((v) => `<div class="rc video"><button type="button" class="img" data-id="${esc(v.id)}" data-titulo="${esc(v.titulo)}" aria-label="Ver video: ${esc(v.titulo)}, ${esc(v.tecnico)}"><img src="${SITIO}${v.foto}" alt="" loading="lazy"><span class="play">▶</span></button><div class="tx"><b>${esc(v.titulo)}</b><span>${esc(v.tecnico)} · ${esc(v.region)}</span><span>${dmy(v.fecha)}</span>${v.obs ? `<span class="obs">Observación: ${esc(v.obs)}</span>` : ""}</div></div>`).join("");
const fotos = FOTOS.map((f) => `<a class="rc" href="${SITIO}${f.foto}" target="_blank" rel="noopener"><div class="img"><img src="${SITIO}${f.foto}" alt="${esc(f.titulo)}" loading="lazy"></div><div class="tx"><b>${esc(f.titulo)}</b><span>Abrir y guardar</span></div></a>`).join("");

const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex">
<title>Recursos del equipo · Cobra</title>
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
.grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
.rc{ display:block; text-decoration:none; color:inherit; border:1px solid var(--border); border-radius:10px; overflow:hidden; background:#fff; transition:box-shadow .15s; }
.rc:hover{ box-shadow:0 6px 18px rgba(0,30,60,.12); }
.rc .img{ display:block; width:100%; padding:0; border:0; cursor:pointer;  position:relative; aspect-ratio:16/10; background:#e8edf2; overflow:hidden; } .rc img{ width:100%; height:100%; object-fit:cover; display:block; }
.rc .img iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; }
.rc .play{ position:absolute; inset:0; margin:auto; width:46px; height:46px; border-radius:50%; background:rgba(0,60,113,.85); color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px; padding-left:3px; }
.rc .tx{ padding:10px 12px; } .rc .tx b{ display:block; font-size:14px; color:var(--navy); } .rc .tx span{ display:block; font-size:12px; color:var(--dim); margin-top:2px; }
.rc .tx .obs{ margin-top:8px; padding:5px 8px; font-weight:600; color:#8a5a12; background:#fdf1e2; border-left:3px solid #e2962e; border-radius:4px; }
.reg{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 0; border-bottom:1px solid var(--border); text-decoration:none; color:inherit; }
.reg:last-child{ border-bottom:none; } .reg b{ display:block; color:var(--navy); } .reg span{ display:block; font-size:13px; color:var(--dim); margin-top:2px; } .reg em{ font-style:normal; font-weight:700; font-size:13px; color:var(--blue); white-space:nowrap; }
.reg:hover em{ text-decoration:underline; }
@media (max-width:520px){ .reg{ flex-direction:column; align-items:flex-start; gap:6px; } }
</style>
<style>${css}</style>
</head><body>
<header class="top"><div class="wrap brand-row"><img src="logo-cobra.png" alt="Cobra"><div class="brand-divider"></div><div class="brand-name">Portal <strong>Supervisor</strong></div><a class="link-portal" href="supervisor.html">&larr; Volver al dashboard</a></div></header>
<section class="hero sin-foto"><div class="wrap"><div><p class="eyebrow">Cobra &middot; Claro VTR</p><h1>Recursos del <b>equipo</b></h1><p class="subtitle">Videos y fotos de los técnicos.</p></div></div></section>
<main>
  <div class="panel"><h2>Videos de técnicos</h2><p class="exp">Armado del conector de campo, grabado por los propios técnicos.</p><div class="grid">${videos}</div></div>
  <div class="panel"><h2>Fotos de terreno</h2><p class="exp">Fotos de los técnicos en terreno. Toca una para abrirla y guardarla.</p>${fotos ? `<div class="grid">${fotos}</div>` : `<p class="exp">Próximamente.</p>`}</div>
</main>
<footer class="foot"><div class="wrap"><span class="by">Diseño y desarrollo <b>J.V.Soft...</b> &middot; <b>SMSI</b> &middot; Construyendo ideas</span></div></footer>
<script>
document.querySelectorAll(".video .img").forEach(function (b) {
  b.addEventListener("click", function () {   // el video se carga solo al tocar y se ve aqui mismo
    var f = document.createElement("iframe");
    f.src = "https://player.vimeo.com/video/" + encodeURIComponent(b.dataset.id) + "?autoplay=1";
    f.title = b.dataset.titulo; f.allow = "autoplay; fullscreen; picture-in-picture"; f.allowFullscreen = true;
    var d = document.createElement("div"); d.className = "img"; d.appendChild(f);
    b.replaceWith(d);
  });
});
</script>
</body></html>`;
publicarProtegida(html, "recursos.html", "recursos", "Recursos del equipo").then(() => console.log("==> Generado recursos.html:", VIDEOS.length, "videos,", FOTOS.length, "fotos,")).catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
