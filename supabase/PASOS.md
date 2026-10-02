# Pasos en Supabase (los hace el dueño de la cuenta, una sola vez)

Son unos 10 minutos. El panel de Supabase está en inglés; los nombres de los menús van tal como aparecen.

## 1. Cuenta y proyecto

1. Entrar a https://supabase.com y crear la cuenta.
2. **New project**: nombre `portal-supervisores`, región **South America (São Paulo)**.
3. Pide una "Database password": anotarla en un lugar seguro (no se usa en el portal, pero no se puede recuperar).

## 2. Cerrar el registro público

En **Authentication > Sign In / Providers**:

- Desactivar **Allow new users to sign up**. Así nadie se puede crear un usuario por su cuenta; solo el administrador los crea.
- En **Email**, desactivar **Confirm email** (los correos son ficticios, no llega nada).

## 3. Tablas y funciones

**SQL Editor > New query**: pegar completo el archivo `supabase/esquema.sql` y apretar **Run**. Debe decir "Success".

## 4. Usuario administrador

**Authentication > Users > Add user > Create new user**:

- Email: el usuario que quieras, terminado en `@portal.local` (ejemplo: `jvodnizza@portal.local`; en el portal se entra solo con `jvodnizza`).
- Password: la clave del administrador.
- Marcar **Auto Confirm User**.

El primer usuario que se crea queda como administrador. Los demás se crean después desde `admin.html`.

## 5. Función de administración

**Edge Functions > Deploy a new function > Via Editor**:

- Nombre: `admin-usuarios` (exacto).
- Borrar el código de ejemplo y pegar el archivo `supabase/functions/admin-usuarios/index.ts`.
- **Deploy**.

## 6. Datos del proyecto en `.env.local`

En **Project Settings > API Keys** (y la URL en **Project Settings > Data API**), agregar estas tres líneas al final de `.env.local`:

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=la llave "publishable" (o "anon public")
SUPABASE_SERVICE_KEY=la llave "secret" (o "service_role")
```

La llave **secret** da control total del proyecto: va solo en `.env.local` (que no se sube a GitHub). No pegarla en chats ni en correos.

## Después

Avisar que está listo. Lo que sigue lo hace el generador: cifrar `supervisor.html`, `reiteradas.html` y `vecino.html`, crear `admin.html`, probar el ingreso real y limpiar el historial público del repositorio antes de publicar.
