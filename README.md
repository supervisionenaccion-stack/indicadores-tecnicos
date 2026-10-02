# Portal de Técnicos — Claro/VTR

Cada técnico entra solo con su **ID** (últimos 6 caracteres de su RUT,
K → 0) y ve sus propios indicadores: Calidad (repetidos 30 días),
Derivaciones (Alta/Migración) y Producción RGU. Es un sitio estático, sin
servidor: los HTML se generan en este equipo y se publican en GitHub Pages:
https://supervisionenaccion-stack.github.io/portal-tecnicos-claro-vtr/

## Estructura

```
portal-tecnicos/
├── index.html                          ← pagina generada, con el avance del mes en curso
├── supervisor.html                     ← vista de supervisores, generada
├── reiteradas.html                     ← reporte de actividades reiteradas del mes (boton en supervisor.html), generado
├── vecino.html                         ← reporte de consulta de estado vecino (boton en supervisor.html), generado
├── fondo-portada.jpg                   ← foto de la portada del dashboard de supervisores
├── reportes/
│   ├── generar_reiteradas.js           ← consulta la BD y genera reiteradas.html
│   ├── generar_vecino.js               ← consulta la BD y genera vecino.html
│   ├── plantilla-vecino.html           ← plantilla de vecino.html
│   ├── estilo-academia.css             ← formato visual de supervisor, reiteradas y vecino
│   └── plantilla-reiteradas.html       ← plantilla de reiteradas.html
├── template.html                       ← plantilla HTML/CSS/JS (no se edita a mano el index.html)
├── template-supervisor.html            ← plantilla de supervisor.html
├── generar_portal.js                   ← consulta la BD y regenera index.html, supervisor.html + credenciales
├── validar_portal.js                   ← revisa los HTML generados antes de publicar
├── Actualizar_Dashboard.bat            ← DOBLE CLIC: corre generar_portal.js y publica en GitHub
├── Actualizar_Automatico.ps1           ← actualizacion diaria automatica (tarea de Windows, 8:00)
├── logs/                               ← detalle de cada corrida automatica (SOLO local, no se sube)
├── Credenciales_Tecnicos_NO_SUBIR.xlsx ← ID de cada tecnico (SOLO local, no se sube)
├── Tecnicos_Baja_NO_SUBIR.json         ← RUT de tecnicos de baja a excluir (SOLO local, no se sube)
├── Supervisor_Temporal.json             ← reasignaciones temporales de supervisor (se sube, sin RUT)
├── .env.local                          ← credenciales de la base de datos (SOLO local, no se sube)
└── .gitignore
```

## Actualizar

Doble clic en `Actualizar_Dashboard.bat`. Tarda unos minutos porque consulta
la base de datos `Sistemas_local` en vivo.

El técnico necesita ver **cómo van sus indicadores a medida que avanza el
mes**, no el dato de un solo día aislado, así que cada fuente usa un rango
distinto:

- **Derivaciones y RGU** (`MATRIZ_VTR`): mes en curso, desde el día 1 hasta
  el último día con carga completa (el script compara el volumen de filas
  contra los días previos para no incluir un día a medio cargar si se corre
  muy temprano). El número crece día a día hasta cerrar el mes.
- **Calidad** (`CALIDAD_VTR`): el mes calendario **anterior**, completo —
  igual que el reporte mensual ya validado. El indicador de repetido a 30
  días necesita ese tiempo para madurar, así que no se puede mostrar en
  "avance" dentro del mes en curso sin quedar artificialmente bajo.

Ambas fechas quedan indicadas al pie de la página.

**Cambio de mes:** el día 1 de cada mes el portal (y `reiteradas.html`) muestra
cómo **cerró el mes anterior** — todos los períodos se calculan como si fuera el
último día de ese mes, y los textos dicen "Cierre del mes". El día 2 parte con
los datos del mes nuevo. Para probar un cambio de mes sin esperar la fecha:
`PORTAL_HOY=AAAA-MM-DD node generar_portal.js` (también lo leen
`validar_portal.js` y `reportes/generar_reiteradas.js`).

### Actualizacion automatica (todos los dias a las 8:00)

La tarea de Windows **"Portal Tecnicos - Actualizacion diaria"** corre
`Actualizar_Automatico.ps1` a las 8:00. Si el PC estaba apagado a esa
hora, corre apenas se encienda y haya sesion iniciada. El script:

1. Genera los HTML con `generar_portal.js` (todo se procesa en este equipo).
2. Los revisa con `validar_portal.js`: fecha de hoy, periodos correctos,
   misma cantidad de tecnicos en ambas paginas, sin RUT completos, y que no
   haya caido mas de un 20% la cantidad de tecnicos respecto de lo
   publicado. Si algo falla, **no publica nada**.
3. Genera `reiteradas.html` con `reportes/generar_reiteradas.js` (ver
   abajo). Si este paso falla, queda publicada la version anterior del
   reporte y el resto del portal se publica igual.
4. Sube solo `index.html`, `supervisor.html` y `reiteradas.html` a GitHub (reintenta).
5. Espera a que el sitio publico muestre exactamente el archivo nuevo.
6. Avisa con una notificacion de Windows: "Portal actualizado y publicado",
   "Portal sin cambios" o "Portal NO actualizado" con el motivo.

El detalle de cada corrida queda en `logs/actualizacion_AAAA-MM-DD.log`.

## Reporte de actividades reiteradas del mes

`reiteradas.html` se abre desde el boton **"Reiterados dentro del mes en curso"**
de `supervisor.html`, debajo del filtro de supervisor (abre con el supervisor
que este seleccionado). Muestra las
actividades de Cobra cerradas en el **mes en curso** (`CALIDAD_VTR`) que
tuvieron una Reparacion posterior del mismo cliente dentro del mismo mes,
con la misma logica de "repetido mas cercano" que Calidad. Trae resumen por
supervisor, tecnico, causa, actividad original y dias, mas el detalle de
cada caso (ordenes, N° de cliente, empresa y tecnico de la reparacion), con
exportacion a Excel de las tablas de tecnicos y detalle.

Es dato parcial: las actividades de los ultimos dias aun no alcanzan a
mostrar sus reiteraciones, asi que el % sube a medida que avanza el mes.

Se genera con `node reportes/generar_reiteradas.js` (tambien lo corren el
`.bat` y la actualizacion automatica). Ademas deja una copia por mes en
`reportes/Reiteradas_Calidad_AAAA-MM.html`, solo local (no se sube).

> Ojo: el sitio es publico y este reporte incluye N° de cliente y numeros de
> orden (decision tomada el 30-09-2026).

## Formato visual

`supervisor.html`, `reiteradas.html` y `vecino.html` usan el sistema de diseño
de la Academia Técnica (el mismo del Portal del Supervisor de Tigo): azul
marino y ámbar, esquinas rectas, títulos livianos con la palabra clave en
negrita, tablas con encabezado marino, cifras en fuente monoespaciada y sin
emojis. Todo el estilo vive en **`reportes/estilo-academia.css`**; cada
generador lo incrusta en su página (marca `/*__ESTILO_ACADEMIA__*/` de la
plantilla), después de los estilos propios de la plantilla. Para cambiar un
color o un tamaño en las tres páginas, se edita solo ese archivo.

- Solo el dashboard lleva foto en la portada (`fondo-portada.jpg`); los dos
  reportes tienen la portada azul con las líneas de fibra.
- Excepciones al sistema, pedidas para este portal: ancho máximo de 1400px,
  un rojo para el estado crítico, portada más baja, pie centrado sin logo.
- El **portal del técnico (`index.html`) todavía no usa este formato**.
- Al cargar, las cifras del resumen suben desde cero y las líneas del gráfico
  de Calidad y Producción se dibujan de izquierda a derecha (no se anima si el
  equipo tiene activado "reducir movimiento").

## Consulta de estado vecino

Mide en qué porcentaje de las órdenes **completadas** (Alta, Migración,
Reparación y Alta Traslado) el técnico hizo la consulta de estado vecino. Es
obligatoria en todas: la meta es **100%**. "Hizo la consulta" = la orden tiene
algún resultado en `MATRIZ_VTR.[Flag Consulta Vecino]` (OK, NOK o En Proceso);
vacío = no la hizo. No se usa `MATRIZ_VTR_VECINOS`, que es una copia parcial
con solo las consultas OK.

- **Supervisor**: botón **"Consulta de estado vecino"** en `supervisor.html`,
  debajo del de reiterados. Abre `vecino.html` con el supervisor seleccionado:
  resumen del equipo, tabla por técnico con sus órdenes sin consulta, por tipo
  de orden y mes a mes (desde agosto de 2026), con exportación a Excel.
- **Técnico**: una lámina más en su portal, bajo Producción RGU, con **solo su
  cumplimiento** (sus datos van dentro de su registro en `index.html`; el
  portal del técnico no enlaza a `vecino.html`).

Se genera con `node reportes/generar_vecino.js` (también lo corren el `.bat` y
la actualización automática; si falla, el resto del portal se publica igual).
`generar_portal.js` usa el mismo cálculo (`obtenerVecino`) para el portal del
técnico. El día 1 muestra el cierre del mes anterior, como el resto del portal.

## Repartir los accesos a los técnicos

Cada corrida genera `Credenciales_Tecnicos_NO_SUBIR.xlsx` con el ID de
cada técnico (nunca se sube a git — está en `.gitignore`). Es solo para que
se lo repartas a cada técnico; no hay clave adicional, el ID es el
único dato de acceso.

El ID se deriva directamente del RUT, así que es estable mientras el
técnico no cambie de RUT y no requiere manejo de duplicados por nombre como
antes. Aun así, dos RUT distintos podrían coincidir por azar en esos 6
caracteres (con la cantidad actual de técnicos no ha pasado nunca) — si
ocurriera, el script lo advierte en la consola porque uno de los dos
quedaría viendo los datos del otro.

## Tecnicos de baja

`SUPERVISORES_VTR` no tiene una columna de estado (activo/de baja): la tabla
sigue listando a cualquier RUT que alguna vez tuvo datos. Por eso la
exclusion de tecnicos que ya no trabajan se maneja a mano, en
`Tecnicos_Baja_NO_SUBIR.json` (mismo criterio de privacidad que el Excel de
credenciales: contiene RUT completo, por eso nunca se sube a git). Formato:

```json
[
  { "rut": "12345678-9", "nombre": "Referencia para humanos, no se usa para el match" }
]
```

`generar_portal.js` los excluye por RUT (normalizado) antes de generar
`index.html`, `supervisor.html` y el Excel de credenciales, en cada corrida.

## Reasignacion temporal de supervisor

Cuando un supervisor esta temporalmente en otras actividades y otro cubre a
su equipo mientras tanto (ej. septiembre 2026: Rolando Montoya en otras
actividades, Danilo Ojeda a cargo de los tecnicos de RM), se maneja en
`Supervisor_Temporal.json` — a diferencia del archivo de bajas, este SI se
sube a git porque solo tiene nombres de supervisor, sin RUT. Formato:

```json
[
  {
    "activo": true,
    "supervisorOriginal": "NOMBRE COMPLETO DEL SUPERVISOR REEMPLAZADO",
    "supervisorTemporal": "NOMBRE COMPLETO DEL SUPERVISOR QUE CUBRE",
    "motivo": "Por que existe esta reasignacion (para referencia humana)",
    "desde": "2026-09-01"
  }
]
```

`generar_portal.js` reemplaza el campo SUPERVISOR de cada tecnico afectado
apenas se leen los datos de `SUPERVISORES_VTR`, asi que el cambio se refleja
en todo el portal (filtros, rankings, evolutivos) sin tocar nada mas. Para
volver a la normalidad cuando el supervisor original regrese, basta con
poner `"activo": false` (o borrar la entrada) — no hace falta tocar codigo.

## Privacidad

El RUT completo de los técnicos nunca se embebe en `index.html`: solo se
usa en memoria, al generar el sitio, para calcular el ID y para agrupar
los datos internamente. El objeto que se escribe en el HTML usa el ID
como clave, no el RUT completo.

## Criterios de filtrado (heredados de las consultas Power Query originales)

- **Calidad**: `CALIDAD_VTR`, filtrado por `Fecha_Cierre`, con la lógica de
  vinculación de "orden repetido" más cercano en el tiempo (repetido dentro
  de 30 días), cruzado con `SUPERVISORES_VTR`.
- **Derivaciones**: `MATRIZ_VTR`, técnicos con "cobr"/"cbr" en el campo
  Técnico, con Orden de Trabajo, Tipo de Actividad en {Alta, Migración}.
  Q Órdenes = Estado Completado o No Realizada; Q Derivaciones = Estado No
  Realizada.
- **RGU**: debe dar siempre lo mismo que el Excel de producción con el que
  se paga (`PROYECTO VTR <MES>.xlsm`, consultas "Q actividades" y
  "FTTH-NFTT"). Técnicos con "cobr"/"cbr" en el campo Técnico y presentes en
  `SUPERVISORES_VTR`. RGU completada = suma de RGU > 0 de actividades
  Completado, o No Realizada con Área derivación = GSA (sin exigir Orden de
  Trabajo). Día trabajado = día con al menos una actividad con Orden de
  Trabajo. Si el Excel cambia de criterio, hay que cambiar `calcularRgu()`.

## Metas de negocio (ajustar en `generar_portal.js`/`template.html` si cambian)

Tomadas de la tabla "Producción VTR-Claro" que el usuario compartió
(22-ago-2026):

- **Meta Calidad por ciudad** (`META_CALIDAD_POR_CIUDAD` en
  `generar_portal.js`): % máximo de repetidos a 30 días — Arica 4.76%,
  Santiago 5.62%, V Región 5.56%. Estado binario: cumple (✅) o foco
  prioritario (🔴), sin nivel intermedio de atención.
- **Meta RGU diaria por ciudad** (`META_RGU_DIARIA_POR_CIUDAD` en
  `generar_portal.js`): Arica 4.3, Santiago 4, V Región 4. La meta del
  período de cada técnico = meta diaria × días trabajados (no días calendario
  del mes — así un técnico con menos días trabajados/activos no queda en
  desventaja). Día trabajado = día en que el técnico tuvo al menos una
  actividad con Orden de Trabajo, aunque no haya completado ninguna — mismo
  criterio que `Q_TECNICO` del Excel de producción con el que se paga. %
  Cumplimiento = RGU Completada GSA ÷ meta del período.
- **Meta Derivaciones** (`META_DERIVACIONES` en `template.html`): oficial,
  no superar 35%.

## Acceso de supervisores (usuario y clave)

`supervisor.html`, `reiteradas.html` y `vecino.html` se publican **cifradas** (AES-256-GCM) dentro de una pantalla de ingreso. La copia sin cifrar queda en `privado/` (no se sube). La llave de cada generación se guarda en Supabase y solo la entrega la función `ingresar()`, que valida usuario y clave y anota el ingreso.

- `reportes/proteger.js`: cifra la página y guarda la llave. Lo usan los tres generadores.
- `reportes/plantilla-acceso.html` y `reportes/acceso-cliente.js`: pantalla de ingreso y cliente de Supabase.
- `admin.html` (de `reportes/plantilla-admin.html`): usuarios y registro de ingresos, solo para el administrador.
- `reportes/generar_acceso.js`: `recifrar` (vuelve a cifrar desde `privado/` sin consultar la base), `admin`, `prueba`, `prueba-real`.
- `supabase/`: `esquema.sql` (tablas y funciones), la función `admin-usuarios` y `PASOS.md` (configuración inicial).
- `.env.local` necesita `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_KEY`. Si Supabase no responde al generar, no se publica.
- Toda clave puesta por el administrador es provisoria: el usuario define la suya en el primer ingreso.
