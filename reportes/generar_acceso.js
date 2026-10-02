// Paginas del sistema de acceso de supervisores.
//
//   node reportes/generar_acceso.js prueba   -> prueba_login.html y prueba_admin.html
//       Solo para mirar como queda: no usan Supabase y NO se publican.
//       prueba_login.html es el supervisor.html actual detras de la pantalla
//       de ingreso (entra con cualquier usuario y clave).
//
//   node reportes/generar_acceso.js prueba-real -> prueba_login_real.html y prueba_admin_real.html
//       Lo mismo, pero contra Supabase (usuarios y registro reales). Tampoco se publican.
//
//   node reportes/generar_acceso.js recifrar -> supervisor.html, reiteradas.html y vecino.html
//       Los vuelve a cifrar desde privado/ (sin consultar la base de datos).
//
//   node reportes/generar_acceso.js admin    -> admin.html
//       La pagina de administracion real. No lleva datos dentro (los lee de
//       Supabase con la sesion del administrador), por eso se publica tal cual.
//       Hay que regenerarla solo si cambia la plantilla o el proyecto de Supabase.

const fs = require("fs");
const path = require("path");
const { protegerPagina, protegerPaginaPrueba, publicarProtegida, leerSinCifrar, configSupabase, DOMINIO_USUARIOS } = require("./proteger.js");

const PAGINAS = [
  ["supervisor.html", "supervisor", "Dashboard de supervisores"],
  ["reiteradas.html", "reiteradas", "Reiterados dentro del mes"],
  ["vecino.html", "vecino", "Consulta de estado vecino"],
];

const RAIZ = path.join(__dirname, "..");

function armarAdmin({ url, anonKey, prueba }) {
  const reemplazos = {
    __LOGO__: "data:image/png;base64," + fs.readFileSync(path.join(RAIZ, "logo-cobra.png")).toString("base64"),
    __CLIENTE_JS__: fs.readFileSync(path.join(__dirname, "acceso-cliente.js"), "utf-8"),
    __SUPABASE_URL__: url || "",
    __SUPABASE_KEY__: anonKey || "",
    __DOMINIO__: DOMINIO_USUARIOS,
    __PRUEBA__: prueba ? "1" : "0",
  };
  const plantilla = fs.readFileSync(path.join(__dirname, "plantilla-admin.html"), "utf-8");
  return plantilla.replace(/__[A-Z_]+__/g, (marca) => (marca in reemplazos ? reemplazos[marca] : marca));
}

const modo = process.argv[2];
if (modo === "prueba") {
  const original = leerSinCifrar("supervisor.html");
  fs.writeFileSync(path.join(RAIZ, "prueba_login.html"), protegerPaginaPrueba(original, "supervisor", "Dashboard de supervisores"), "utf-8");
  fs.writeFileSync(path.join(RAIZ, "prueba_admin.html"), armarAdmin({ prueba: true }), "utf-8");
  console.log("Listo: prueba_login.html y prueba_admin.html (no se publican)");
} else if (modo === "prueba-real") {
  // Igual que la pagina que se publicara: usuarios y registro reales de Supabase.
  const original = leerSinCifrar("supervisor.html");
  protegerPagina(original, "supervisor", "Dashboard de supervisores").then((html) => {
    fs.writeFileSync(path.join(RAIZ, "prueba_login_real.html"), html, "utf-8");
    fs.writeFileSync(path.join(RAIZ, "prueba_admin_real.html"), armarAdmin(configSupabase()), "utf-8");
    console.log("Listo: prueba_login_real.html y prueba_admin_real.html (no se publican)");
  }).catch((err) => { console.error(err.message); process.exit(1); });
} else if (modo === "recifrar") {
  // Vuelve a cifrar las paginas desde privado/ sin consultar la base. Sirve
  // tras editar a mano la copia de privado/ (cambios solo de plantilla o estilo)
  // y para proteger por primera vez las paginas que aun estan sin cifrar.
  (async () => {
    for (const [archivo, pagina, titulo] of PAGINAS) {
      await publicarProtegida(leerSinCifrar(archivo), archivo, pagina, titulo);
      console.log("Cifrado: " + archivo);
    }
  })().catch((err) => { console.error(err.message); process.exit(1); });
} else if (modo === "admin") {
  const cfg = configSupabase();
  fs.writeFileSync(path.join(RAIZ, "admin.html"), armarAdmin(cfg), "utf-8");
  console.log("Listo: admin.html");
} else {
  console.error("Uso: node reportes/generar_acceso.js prueba | prueba-real | recifrar | admin");
  process.exit(1);
}
