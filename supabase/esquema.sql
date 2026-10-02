-- Acceso de supervisores al portal: usuarios, registro de ingresos y llaves.
-- Se pega completo en Supabase > SQL Editor > New query > Run. Se puede correr
-- mas de una vez sin romper nada.
--
-- Como funciona:
--   * Los usuarios viven en Supabase Auth con un correo ficticio
--     (usuario@portal.local). "perfiles" guarda nombre, rol y si esta activo.
--   * Las paginas publicadas van cifradas. "llaves" guarda la llave de cada
--     generacion y nadie la puede leer directamente.
--   * La funcion ingresar() es la unica puerta: valida al usuario, anota el
--     ingreso en "ingresos" y recien ahi entrega la llave.
--   * El primer usuario que se crea queda como administrador y activo. Los
--     siguientes nacen inactivos hasta que el administrador los activa (la
--     pagina admin.html lo hace sola al crearlos).

create table if not exists public.perfiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  usuario text not null unique,
  nombre  text not null default '',
  rol     text not null default 'supervisor' check (rol in ('admin', 'supervisor')),
  activo  boolean not null default false,
  creado  timestamptz not null default now()
);

create table if not exists public.ingresos (
  id        bigint generated always as identity primary key,
  fecha     timestamptz not null default now(),
  user_id   uuid,
  usuario   text not null,
  pagina    text not null,
  resultado text not null default 'ok'   -- ok | inactivo | clave_incorrecta | cambio_clave | borro_N_registros
);
create index if not exists ingresos_fecha_idx on public.ingresos (fecha desc);

create table if not exists public.llaves (
  pagina text not null,
  kid    text not null,
  llave  text not null,
  creada timestamptz not null default now(),
  primary key (pagina, kid)
);

-- Clave provisoria: al crear un usuario, o cuando el administrador le cambia la
-- clave, debe definir una propia antes de poder entrar.
alter table public.perfiles add column if not exists debe_cambiar boolean not null default true;
create extension if not exists pgcrypto with schema extensions;

alter table public.perfiles enable row level security;
alter table public.ingresos enable row level security;
alter table public.llaves   enable row level security;   -- sin politicas: nadie la lee desde afuera

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;

drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());

drop policy if exists ingresos_ver on public.ingresos;
create policy ingresos_ver on public.ingresos for select to authenticated
  using (public.es_admin());

-- Perfil automatico al crear un usuario. No confia en nada que venga del
-- usuario: el rol y el estado solo los cambia el administrador.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  primero boolean := not exists (select 1 from public.perfiles);
begin
  insert into public.perfiles (id, usuario, rol, activo)
  values (new.id, split_part(new.email, '@', 1), case when primero then 'admin' else 'supervisor' end, primero)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_perfil_al_registrar on auth.users;
create trigger crear_perfil_al_registrar after insert on auth.users
  for each row execute function public.crear_perfil();

-- Puerta de entrada. p_kid nulo = solo registrar el ingreso (pagina admin).
create or replace function public.ingresar(p_pagina text, p_kid text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.perfiles;
  v_llave text;
  v_pagina text := left(coalesce(p_pagina, ''), 40);
begin
  select * into p from public.perfiles where id = auth.uid();
  if p.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_perfil');
  end if;
  if not p.activo then
    insert into public.ingresos (user_id, usuario, pagina, resultado) values (p.id, p.usuario, v_pagina, 'inactivo');
    return jsonb_build_object('ok', false, 'motivo', 'inactivo');
  end if;
  if p.debe_cambiar then
    return jsonb_build_object('ok', false, 'motivo', 'cambiar_clave');
  end if;
  if p_kid is not null then
    select llave into v_llave from public.llaves where pagina = p_pagina and kid = p_kid;
    if v_llave is null then
      return jsonb_build_object('ok', false, 'motivo', 'sin_llave');
    end if;
  end if;
  insert into public.ingresos (user_id, usuario, pagina) values (p.id, p.usuario, v_pagina);
  return jsonb_build_object('ok', true, 'llave', v_llave, 'usuario', p.usuario, 'nombre', p.nombre, 'rol', p.rol);
end;
$$;

-- El usuario define su propia clave (obligatorio mientras debe_cambiar este
-- marcado). Debe tener 8 caracteres o mas y ser distinta de la actual.
create or replace function public.cambiar_clave(p_nueva text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  p public.perfiles;
  v_actual text;
begin
  select * into p from public.perfiles where id = auth.uid();
  if p.id is null or not p.activo then
    return jsonb_build_object('ok', false, 'motivo', 'sin_acceso');
  end if;
  if length(coalesce(p_nueva, '')) < 8 then
    return jsonb_build_object('ok', false, 'motivo', 'corta');
  end if;
  select encrypted_password into v_actual from auth.users where id = p.id;
  if v_actual = crypt(p_nueva, v_actual) then
    return jsonb_build_object('ok', false, 'motivo', 'igual');
  end if;
  update auth.users set encrypted_password = crypt(p_nueva, gen_salt('bf', 10)), updated_at = now() where id = p.id;
  update public.perfiles set debe_cambiar = false where id = p.id;
  insert into public.ingresos (user_id, usuario, pagina, resultado) values (p.id, p.usuario, '-', 'cambio_clave');
  return jsonb_build_object('ok', true);
end;
$$;

-- La llama admin.html despues de asignarle una clave nueva a alguien.
create or replace function public.exigir_cambio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo el administrador'; end if;
  update public.perfiles set debe_cambiar = true where id = p_id;
end;
$$;

-- Limpieza del registro: la llama admin.html despues de exportar. Solo borra
-- ingresos con mas de 30 dias (los 29 dias dan margen por la hora del
-- navegador) y deja anotado quien borro y cuantos.
create or replace function public.borrar_ingresos(p_hasta timestamptz) returns integer
language plpgsql security definer set search_path = public as $$
declare
  p public.perfiles;
  n integer;
begin
  select * into p from public.perfiles where id = auth.uid();
  if p.id is null or p.rol <> 'admin' or not p.activo then raise exception 'solo el administrador'; end if;
  if p_hasta is null or p_hasta > now() - interval '29 days' then raise exception 'solo se pueden borrar registros de mas de un mes'; end if;
  delete from public.ingresos where fecha < p_hasta;
  get diagnostics n = row_count;
  insert into public.ingresos (user_id, usuario, pagina, resultado) values (p.id, p.usuario, '-', 'borro_' || n || '_registros');
  return n;
end;
$$;

-- Intentos con clave incorrecta (lo llama la pantalla de ingreso sin sesion).
-- Con tope por minuto para que nadie llene la tabla.
create or replace function public.registrar_fallo(p_usuario text, p_pagina text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ingresos where resultado = 'clave_incorrecta' and fecha > now() - interval '1 minute') < 30 then
    insert into public.ingresos (usuario, pagina, resultado)
    values (left(coalesce(p_usuario, ''), 60), left(coalesce(p_pagina, ''), 40), 'clave_incorrecta');
  end if;
end;
$$;

-- La usa el generador (con la llave secreta) en cada actualizacion del portal.
-- Conserva las llaves de los ultimos 30 dias (y siempre las 5 mas nuevas), para
-- que la pagina publicada siga abriendo aunque se regenere varias veces.
create or replace function public.guardar_llave(p_pagina text, p_kid text, p_llave text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.llaves (pagina, kid, llave) values (p_pagina, p_kid, p_llave)
  on conflict (pagina, kid) do update set llave = excluded.llave, creada = now();
  delete from public.llaves
  where pagina = p_pagina
    and creada < now() - interval '30 days'
    and kid not in (select kid from public.llaves where pagina = p_pagina order by creada desc limit 5);
end;
$$;

-- ===================== Ingresos de tecnicos a su portal =====================
-- El portal del tecnico (index.html) no usa cuentas: entra con su ID. Cada vez
-- que escribe su ID, la pagina avisa aca. "tecnicos" es la lista vigente (la
-- sube el generador en cada actualizacion) y sirve para aceptar solo ID reales
-- y para mostrar nombres en admin.html.
create table if not exists public.tecnicos (
  id          text primary key,
  nombre      text not null,
  supervisor  text not null default '',
  agencia     text not null default '',
  actualizado timestamptz not null default now()
);
create table if not exists public.ingresos_tecnicos (
  id         bigint generated always as identity primary key,
  fecha      timestamptz not null default now(),
  tecnico_id text not null
);
create index if not exists ingresos_tecnicos_fecha_idx on public.ingresos_tecnicos (fecha desc);
create index if not exists ingresos_tecnicos_tecnico_idx on public.ingresos_tecnicos (tecnico_id, fecha desc);
alter table public.tecnicos enable row level security;
alter table public.ingresos_tecnicos enable row level security;

drop policy if exists tecnicos_ver on public.tecnicos;
create policy tecnicos_ver on public.tecnicos for select to authenticated using (public.es_admin());
drop policy if exists ingresos_tecnicos_ver on public.ingresos_tecnicos;
create policy ingresos_tecnicos_ver on public.ingresos_tecnicos for select to authenticated using (public.es_admin());

-- La llama index.html sin sesion. Ignora ID que no existen, repeticiones del
-- mismo tecnico en menos de 2 minutos y rafagas (tope por minuto).
create or replace function public.registrar_tecnico(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tecnicos where id = p_id) then return; end if;
  if exists (select 1 from public.ingresos_tecnicos where tecnico_id = p_id and fecha > now() - interval '2 minutes') then return; end if;
  if (select count(*) from public.ingresos_tecnicos where fecha > now() - interval '1 minute') >= 60 then return; end if;
  insert into public.ingresos_tecnicos (tecnico_id) values (p_id);
end;
$$;

-- La usa el generador (llave secreta): deja "tecnicos" igual a la lista del portal.
create or replace function public.sincronizar_tecnicos(p_lista jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if p_lista is null or jsonb_array_length(p_lista) = 0 then raise exception 'lista vacia'; end if;
  insert into public.tecnicos (id, nombre, supervisor, agencia, actualizado)
  select x->>'id', coalesce(x->>'nombre', ''), coalesce(x->>'supervisor', ''), coalesce(x->>'agencia', ''), now()
  from jsonb_array_elements(p_lista) x
  on conflict (id) do update set nombre = excluded.nombre, supervisor = excluded.supervisor, agencia = excluded.agencia, actualizado = now();
  get diagnostics n = row_count;
  delete from public.tecnicos where id not in (select x->>'id' from jsonb_array_elements(p_lista) x);
  return n;
end;
$$;

-- Resumen para admin.html: una fila por tecnico vigente, haya entrado o no.
create or replace function public.resumen_tecnicos() returns table (
  nombre text, supervisor text, agencia text, ultimo timestamptz, ingresos_30 bigint, dias_30 bigint, ingresos_total bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo el administrador'; end if;
  return query
  select t.nombre, t.supervisor, t.agencia,
         max(i.fecha),
         count(i.id) filter (where i.fecha > now() - interval '30 days'),
         count(distinct (i.fecha at time zone 'America/Santiago')::date) filter (where i.fecha > now() - interval '30 days'),
         count(i.id)
  from public.tecnicos t
  left join public.ingresos_tecnicos i on i.tecnico_id = t.id
  group by t.id, t.nombre, t.supervisor, t.agencia
  order by t.nombre;
end;
$$;

-- Detalle para exportar: cada ingreso con el nombre del tecnico.
create or replace function public.detalle_tecnicos(p_desde timestamptz) returns table (
  fecha timestamptz, nombre text, supervisor text, agencia text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo el administrador'; end if;
  return query
  select i.fecha, coalesce(t.nombre, '(ya no está en el portal)'), coalesce(t.supervisor, ''), coalesce(t.agencia, '')
  from public.ingresos_tecnicos i
  left join public.tecnicos t on t.id = i.tecnico_id
  where i.fecha >= p_desde
  order by i.fecha desc
  limit 20000;
end;
$$;

revoke all on public.tecnicos, public.ingresos_tecnicos from anon, authenticated;
grant select on public.tecnicos, public.ingresos_tecnicos to authenticated;
grant all on public.tecnicos, public.ingresos_tecnicos to service_role;
revoke all on function public.registrar_tecnico(text) from public;
revoke all on function public.sincronizar_tecnicos(jsonb) from public, anon, authenticated;
revoke all on function public.resumen_tecnicos() from public, anon;
revoke all on function public.detalle_tecnicos(timestamptz) from public, anon;
grant execute on function public.registrar_tecnico(text) to anon, authenticated;
grant execute on function public.sincronizar_tecnicos(jsonb) to service_role;
grant execute on function public.resumen_tecnicos() to authenticated;
grant execute on function public.detalle_tecnicos(timestamptz) to authenticated;

-- Permisos de tablas, explicitos para no depender de la opcion "Automatically
-- expose new tables" del proyecto. Las politicas de arriba deciden que filas.
revoke all on public.perfiles, public.ingresos, public.llaves from anon, authenticated;
grant select on public.perfiles, public.ingresos to authenticated;
grant all on public.perfiles, public.ingresos, public.llaves to service_role;

revoke all on function public.ingresar(text, text)            from public, anon;
revoke all on function public.registrar_fallo(text, text)     from public;
revoke all on function public.guardar_llave(text, text, text) from public, anon, authenticated;
revoke all on function public.crear_perfil()                  from public, anon, authenticated;
revoke all on function public.cambiar_clave(text) from public, anon;
revoke all on function public.exigir_cambio(uuid) from public, anon;
grant execute on function public.cambiar_clave(text) to authenticated;
revoke all on function public.borrar_ingresos(timestamptz) from public, anon;
grant execute on function public.borrar_ingresos(timestamptz) to authenticated;
grant execute on function public.exigir_cambio(uuid) to authenticated;
grant execute on function public.ingresar(text, text)            to authenticated;
grant execute on function public.registrar_fallo(text, text)     to anon, authenticated;
grant execute on function public.guardar_llave(text, text, text) to service_role;
grant execute on function public.es_admin()                      to authenticated;
