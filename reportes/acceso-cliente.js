// Cliente de acceso (navegador). Lo incrustan la pantalla de ingreso de las
// paginas protegidas (plantilla-acceso.html) y la pagina de administracion
// (plantilla-admin.html). Habla con Supabase por su API REST, sin librerias.
// El supervisor escribe solo "usuario" y clave: por dentro el usuario es el
// correo ficticio usuario@DOMINIO, porque Supabase exige un correo.
const Acceso = (() => {
  const CLAVE_SESION = 'portal_sesion';
  const CLAVE_USUARIO = 'portal_usuario';   // ultimo usuario que entro en este navegador (nunca la clave)
  const CLAVE_MANTENER = 'portal_mantener'; // '1' si marco "Mantener la sesion iniciada"
  const DURACION_MS = 12 * 60 * 60 * 1000;  // pasado este tiempo se pide la clave de nuevo
  const DURACION_LARGA_MS = 30 * 24 * 60 * 60 * 1000; // si marco "Mantener la sesion iniciada"
  let cfg = { url: '', key: '', dominio: 'portal.local' };

  function configurar(c) { cfg = Object.assign(cfg, c); }

  async function pedir(metodo, ruta, cuerpo, token) {
    const headers = { apikey: cfg.key };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(cfg.url + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    let datos = null;
    try { datos = await r.json(); } catch (e) { /* respuesta sin cuerpo */ }
    return { ok: r.ok, estado: r.status, datos };
  }

  function leerSesion() {
    try {
      const s = JSON.parse(localStorage.getItem(CLAVE_SESION));
      if (s && s.rt && Date.now() - s.desde < (s.dura || DURACION_MS)) return s;
    } catch (e) { /* sin sesion */ }
    salir();
    return null;
  }
  // d = respuesta de Supabase Auth. El token de acceso se guarda con su
  // vencimiento para reutilizarlo al pasar de una pagina a otra.
  function guardarSesion(d, desde, dura) {
    const sesion = { rt: d.refresh_token, desde, dura, at: d.access_token, vence: Date.now() + (d.expires_in || 3600) * 1000 };
    try { localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion)); } catch (e) { /* modo privado */ }
  }
  function haySesion() { return !!leerSesion(); }
  function ultimoUsuario() { try { return localStorage.getItem(CLAVE_USUARIO) || ''; } catch (e) { return ''; } }
  function salir() {
    try { localStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada que borrar */ }
  }

  function normalizarUsuario(u) { return String(u || '').trim().toLowerCase(); }

  // Devuelve el token de acceso, o null si usuario o clave no corresponden.
  // Con mantener = true la sesion dura 30 dias en este navegador en vez de 12 horas.
  async function entrar(usuario, clave, mantener) {
    const r = await pedir('POST', '/auth/v1/token?grant_type=password', { email: normalizarUsuario(usuario) + '@' + cfg.dominio, password: clave });
    if (!r.ok) {
      if (r.estado === 400 || r.estado === 401 || r.estado === 422) return null;
      throw new Error('El servicio de acceso respondió ' + r.estado);
    }
    if (mantener === undefined) mantener = quiereMantener();
    recordarMantener(mantener);
    guardarSesion(r.datos, Date.now(), mantener ? DURACION_LARGA_MS : DURACION_MS);
    try { localStorage.setItem(CLAVE_USUARIO, normalizarUsuario(usuario)); } catch (e) { /* modo privado */ }
    return r.datos.access_token;
  }

  // Retoma la sesion guardada en este navegador (si no ha vencido).
  // Con renovar = true pide un token nuevo aunque el guardado no haya vencido.
  async function retomar(renovar) {
    const s = leerSesion();
    if (!s) return null;
    if (!renovar && s.at && Date.now() < s.vence - 60000) return s.at;
    const r = await pedir('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: s.rt });
    if (!r.ok) {
      // Otra pestana pudo renovar al mismo tiempo: si ya dejo un token nuevo, se usa ese.
      const otra = leerSesion();
      if (otra && otra.rt !== s.rt && otra.at && Date.now() < otra.vence - 60000) return otra.at;
      // Solo se cierra la sesion si Supabase la rechaza; una caida de red o del
      // servicio no debe obligar a escribir la clave otra vez.
      if (r.estado === 400 || r.estado === 401 || r.estado === 403) { salir(); return null; }
      throw new Error('El servicio de acceso respondió ' + r.estado);
    }
    guardarSesion(r.datos, s.desde, s.dura);
    return r.datos.access_token;
  }

  // Si la persona eligio "Mantener la sesion iniciada", se recuerda para la proxima vez.
  function quiereMantener() { try { return localStorage.getItem(CLAVE_MANTENER) === '1'; } catch (e) { return false; } }
  function recordarMantener(si) { try { localStorage.setItem(CLAVE_MANTENER, si ? '1' : '0'); } catch (e) { /* modo privado */ } }

  function rpc(nombre, args, token) { return pedir('POST', '/rest/v1/rpc/' + nombre, args, token); }
  function leer(ruta, token) { return pedir('GET', '/rest/v1/' + ruta, undefined, token); }
  function funcion(nombre, cuerpo, token) { return pedir('POST', '/functions/v1/' + nombre, cuerpo, token); }

  // Pantalla para definir una clave propia (clave provisoria). Se resuelve
  // cuando Supabase acepta la clave nueva.
  function pedirClaveNueva(token) {
    return new Promise((listo) => {
      const capa = document.createElement('div');
      capa.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:linear-gradient(135deg,#003575,#00224d);font-family:Helvetica,Arial,sans-serif;';
      const campo = 'width:100%;padding:11px 12px;font-size:16px;border:1px solid #b9c0cc;border-radius:2px;box-sizing:border-box;';
      const rotulo = 'display:block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#62646e;margin:14px 0 6px;';
      capa.innerHTML = '<form style="width:100%;max-width:400px;background:#fff;border-top:3px solid #f0a500;padding:28px;box-sizing:border-box;">'
        + '<p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#3c62ac;">Primer ingreso</p>'
        + '<h1 style="margin:0 0 6px;font-size:24px;font-weight:300;color:#003575;">Define tu <strong>clave</strong></h1>'
        + '<p style="margin:0 0 8px;font-size:14px;color:#62646e;line-height:1.5;">La clave que te entregaron es provisoria. Elige una propia de 8 caracteres o más, distinta de la actual.</p>'
        + '<label style="' + rotulo + '">Clave nueva</label><input type="password" autocomplete="new-password" minlength="8" required style="' + campo + '">'
        + '<label style="' + rotulo + '">Repite la clave nueva</label><input type="password" autocomplete="new-password" minlength="8" required style="' + campo + '">'
        + '<button type="submit" style="width:100%;margin-top:22px;padding:12px;font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:#003575;border:0;border-radius:2px;cursor:pointer;">Guardar clave</button>'
        + '<div role="alert" style="display:none;margin-top:16px;padding:10px 12px;font-size:14px;color:#a3261c;background:#f8e3e0;border-left:3px solid #a3261c;"></div></form>';
      document.body.appendChild(capa);
      const form = capa.querySelector('form'), campos = capa.querySelectorAll('input'), aviso = capa.querySelector('[role=alert]'), boton = capa.querySelector('button');
      const avisar = (t) => { aviso.textContent = t; aviso.style.display = t ? 'block' : 'none'; };
      campos[0].focus();
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (campos[0].value !== campos[1].value) { avisar('Las dos claves no coinciden.'); return; }
        boton.disabled = true;
        try {
          const r = await rpc('cambiar_clave', { p_nueva: campos[0].value }, token);
          if (r.ok && r.datos && r.datos.ok) { capa.remove(); listo(); return; }
          const motivo = r.datos && r.datos.motivo;
          avisar(motivo === 'igual' ? 'La clave nueva debe ser distinta de la que te entregaron.'
            : motivo === 'corta' ? 'La clave debe tener 8 caracteres o más.'
            : 'No se pudo guardar la clave (' + (motivo || r.estado) + ').');
        } catch (err) { avisar('No se pudo guardar la clave. Revisa tu conexión.'); }
        boton.disabled = false;
      });
    });
  }

  return { quiereMantener, pedirClaveNueva, configurar, entrar, retomar, haySesion, ultimoUsuario, salir, rpc, leer, funcion, normalizarUsuario };
})();
