// Proteccion de las paginas de supervisores (supervisor.html, reiteradas.html,
// vecino.html): la pagina real se comprime y se cifra con AES-256-GCM, y lo
// que se publica es una pantalla de ingreso con ese contenido ilegible dentro.
// La llave se guarda en Supabase (tabla "llaves") y solo la entrega la funcion
// "ingresar", que valida al usuario y anota el ingreso. Ver supabase/esquema.sql.
//
// Cada generacion usa una llave nueva (kid distinto). Supabase conserva las
// ultimas, para que la pagina publicada siga abriendo aunque la generacion de
// hoy todavia no se haya subido al sitio.
//
// Variables en .env.local:
//   SUPABASE_URL          https://xxxx.supabase.co
//   SUPABASE_ANON_KEY     llave publica (publishable / anon); va en las paginas
//   SUPABASE_SERVICE_KEY  llave secreta (secret / service_role); NUNCA se publica

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..");
const DOMINIO_USUARIOS = "portal.local";

function leerEnv() {
  const env = {};
  const envPath = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function configSupabase() {
  const env = leerEnv();
  const cfg = { url: (env.SUPABASE_URL || "").replace(/\/+$/, ""), anonKey: env.SUPABASE_ANON_KEY || "", serviceKey: env.SUPABASE_SERVICE_KEY || "" };
  const faltan = ["url", "anonKey", "serviceKey"].filter((k) => !cfg[k]);
  if (faltan.length) throw new Error("Falta configurar Supabase en .env.local (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY)");
  return cfg;
}

function cifrar(html) {
  const llave = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", llave, iv);
  // WebCrypto espera el sello de autenticacion al final del texto cifrado.
  const datos = Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(html, "utf-8"))), cipher.final(), cipher.getAuthTag()]);
  return { kid: crypto.randomBytes(8).toString("hex"), llave: llave.toString("base64"), iv: iv.toString("base64"), datos: datos.toString("base64") };
}

function armarPagina({ pagina, titulo, cifrado, url, anonKey, llavePrueba }) {
  const plantilla = fs.readFileSync(path.join(__dirname, "plantilla-acceso.html"), "utf-8");
  const reemplazos = {
    __TITULO__: titulo,
    __LOGO__: "data:image/png;base64," + fs.readFileSync(path.join(RAIZ, "logo-cobra.png")).toString("base64"),
    __CLIENTE_JS__: fs.readFileSync(path.join(__dirname, "acceso-cliente.js"), "utf-8"),
    __PAGINA__: pagina,
    __KID__: cifrado.kid,
    __IV__: cifrado.iv,
    __DATOS__: cifrado.datos,
    __SUPABASE_URL__: url || "",
    __SUPABASE_KEY__: anonKey || "",
    __DOMINIO__: DOMINIO_USUARIOS,
    __LLAVE_PRUEBA__: llavePrueba || "",
  };
  return plantilla.replace(/__[A-Z_]+__/g, (marca) => (marca in reemplazos ? reemplazos[marca] : marca));
}

async function guardarLlave(cfg, pagina, cifrado) {
  const r = await fetch(cfg.url + "/rest/v1/rpc/guardar_llave", {
    method: "POST",
    headers: { apikey: cfg.serviceKey, Authorization: "Bearer " + cfg.serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_pagina: pagina, p_kid: cifrado.kid, p_llave: cifrado.llave }),
  });
  if (!r.ok) throw new Error(`Supabase no guardo la llave de ${pagina} (${r.status}): ${(await r.text()).slice(0, 200)}`);
}

// Devuelve el HTML que se publica. Si la llave no queda guardada en Supabase,
// lanza error: una pagina sin llave no se podria abrir.
async function protegerPagina(html, pagina, titulo) {
  const cfg = configSupabase();
  const cifrado = cifrar(html);
  await guardarLlave(cfg, pagina, cifrado);
  return armarPagina({ pagina, titulo, cifrado, url: cfg.url, anonKey: cfg.anonKey });
}

// Carpeta local (fuera de git) con las paginas SIN cifrar. De ahi leen la
// validacion, la prueba de brecha y el recifrado; nunca se publica.
const DIR_PRIVADO = path.join(RAIZ, "privado");

// Escribe la pagina sin cifrar en privado/ y la cifrada en la raiz (la que se
// publica). Si Supabase no guarda la llave no se escribe ninguna de las dos.
async function publicarProtegida(html, archivo, pagina, titulo) {
  const protegida = await protegerPagina(html, pagina, titulo);
  fs.mkdirSync(DIR_PRIVADO, { recursive: true });
  fs.writeFileSync(path.join(DIR_PRIVADO, archivo), html, "utf-8");
  fs.writeFileSync(path.join(RAIZ, archivo), protegida, "utf-8");
  return path.join(RAIZ, archivo);
}

function estaCifrada(html) { return html.includes('id="datosCifrados"'); }

// La pagina sin cifrar: la copia de privado/ o, si aun no existe, la de la
// raiz mientras siga sin proteger.
function leerSinCifrar(archivo) {
  const privada = path.join(DIR_PRIVADO, archivo);
  if (fs.existsSync(privada)) return fs.readFileSync(privada, "utf-8");
  const html = fs.readFileSync(path.join(RAIZ, archivo), "utf-8");
  if (estaCifrada(html)) throw new Error(`${archivo} esta cifrado y no hay copia en privado/ (correr antes el generador)`);
  return html;
}

// Deja en Supabase la lista vigente de tecnicos (ID, nombre, supervisor,
// agencia) para el registro de ingresos al portal del tecnico. Es un
// complemento: quien la llama decide si un fallo detiene la generacion.
async function sincronizarTecnicos(lista) {
  const cfg = configSupabase();
  const r = await fetch(cfg.url + "/rest/v1/rpc/sincronizar_tecnicos", {
    method: "POST",
    headers: { apikey: cfg.serviceKey, Authorization: "Bearer " + cfg.serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_lista: lista }),
  });
  if (!r.ok) throw new Error(`Supabase no guardo la lista de tecnicos (${r.status}): ${(await r.text()).slice(0, 200)}`);
}

// Solo para paginas prueba_*.html (no se publican): la llave va dentro de la
// pagina y se entra con cualquier usuario y clave, sin Supabase.
function protegerPaginaPrueba(html, pagina, titulo) {
  const cifrado = cifrar(html);
  return armarPagina({ pagina, titulo, cifrado, llavePrueba: cifrado.llave });
}

module.exports = { sincronizarTecnicos, protegerPagina, protegerPaginaPrueba, publicarProtegida, leerSinCifrar, estaCifrada, configSupabase, leerEnv, DOMINIO_USUARIOS, DIR_PRIVADO };
