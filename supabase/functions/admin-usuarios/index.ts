// Funcion de Supabase (Edge Function) "admin-usuarios": crear usuarios,
// cambiar claves y activar/desactivar. La llama admin.html. Solo responde a un
// usuario con rol admin y activo; la llave secreta nunca sale de Supabase.
// Se despliega desde el panel: Edge Functions > Deploy a new function > Via
// Editor, con el nombre admin-usuarios, pegando este archivo.
import { createClient } from "npm:@supabase/supabase-js@2";

const DOMINIO = "portal.local";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...cors, "Content-Type": "application/json" } });
}

// La llave secreta la pone Supabase en el entorno de la funcion; el nombre
// depende de si el proyecto usa las llaves nuevas o las antiguas.
function llaveSecreta(): string {
  const directa = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("LLAVE_SECRETA");
  if (directa) return directa;
  const varias = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (varias) {
    try {
      const o = JSON.parse(varias);
      const primera = Array.isArray(o) ? o[0] : Object.values(o)[0];
      if (primera) return String(typeof primera === "object" ? Object.values(primera as object)[0] : primera);
    } catch (_e) {
      return varias;
    }
  }
  const nombres = Object.keys(Deno.env.toObject()).filter((n) => n.startsWith("SUPABASE") || n.startsWith("SB_"));
  throw new Error("La función no encontró la llave secreta. Variables disponibles: " + nombres.join(", "));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, llaveSecreta(), { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quien } = await sb.auth.getUser(token);
    if (!quien?.user) return responder({ error: "Sesión no válida" }, 401);
    const { data: yo } = await sb.from("perfiles").select("id, rol, activo").eq("id", quien.user.id).maybeSingle();
    if (!yo || yo.rol !== "admin" || !yo.activo) return responder({ error: "Solo el administrador puede hacer esto" }, 403);

    const b = await req.json();

    if (b.accion === "crear") {
      const usuario = String(b.usuario || "").trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return responder({ error: "El usuario debe tener 3 a 30 letras, números, punto o guion" }, 400);
      if (String(b.clave || "").length < 6) return responder({ error: "La clave debe tener al menos 6 caracteres" }, 400);
      const { data, error } = await sb.auth.admin.createUser({ email: `${usuario}@${DOMINIO}`, password: b.clave, email_confirm: true });
      if (error) return responder({ error: error.message }, 400);
      const { error: e2 } = await sb.from("perfiles")
        .update({ nombre: String(b.nombre || "").trim(), rol: b.rol === "admin" ? "admin" : "supervisor", activo: true })
        .eq("id", data.user.id);
      if (e2) return responder({ error: e2.message }, 400);
      return responder({ ok: true });
    }

    if (b.accion === "clave") {
      if (String(b.clave || "").length < 6) return responder({ error: "La clave debe tener al menos 6 caracteres" }, 400);
      const { error } = await sb.auth.admin.updateUserById(b.id, { password: b.clave });
      if (error) return responder({ error: error.message }, 400);
      return responder({ ok: true });
    }

    if (b.accion === "editar") {
      const cambios: Record<string, unknown> = {};
      if (typeof b.nombre === "string") cambios.nombre = b.nombre.trim();
      if (b.rol === "admin" || b.rol === "supervisor") cambios.rol = b.rol;
      if (typeof b.activo === "boolean") cambios.activo = b.activo;
      if (b.id === yo.id && (cambios.activo === false || cambios.rol === "supervisor")) {
        return responder({ error: "No puedes desactivar ni quitarle el rol de administrador a tu propio usuario" }, 400);
      }
      const { error } = await sb.from("perfiles").update(cambios).eq("id", b.id);
      if (error) return responder({ error: error.message }, 400);
      return responder({ ok: true });
    }

    return responder({ error: "Acción desconocida" }, 400);
  } catch (err) {
    return responder({ error: String((err as Error).message || err) }, 500);
  }
});
