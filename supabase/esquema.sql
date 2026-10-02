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
  resultado text not null default 'ok'   -- ok | inactivo | clave_incorrecta | cambio_clave
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
grant execute on function public.exigir_cambio(uuid) to authenticated;
grant execute on function public.ingresar(text, text)            to authenticated;
grant execute on function public.registrar_fallo(text, text)     to anon, authenticated;
grant execute on function public.guardar_llave(text, text, text) to service_role;
grant execute on function public.es_admin()                      to authenticated;
