# Actualizacion automatica diaria del portal (la corre el Programador de
# tareas de Windows, tarea "Portal Tecnicos - Actualizacion diaria", 08:00).
# Mismo flujo que Actualizar_Dashboard.bat, pero sin pausas y con controles:
#   1. generar_portal.js  -> consulta la BD y genera los HTML (todo local)
#   2. validar_portal.js  -> si algo no cuadra, NO se publica nada
#   2a. reportes\subir_datos_tecnicos.js -> datos de cada tecnico a Supabase
#       (index.html va sin ellos); si falla, NO se publica nada
#   2b. reportes\generar_reiteradas.js -> reiteradas.html (boton en supervisor.html);
#       si falla, se deja la version anterior y el resto se publica igual
#   2c. reportes\generar_vecino.js -> vecino.html (boton en supervisor.html);
#       si falla, se deja la version anterior y el resto se publica igual
#   2d. reportes\generar_brecha.js -> brecha.html (boton en supervisor.html);
#       si falla, se deja la version anterior y el resto se publica igual
#   2e. reportes\generar_graficos.js -> graficos.html (boton en supervisor.html);
#       si falla, se deja la version anterior y el resto se publica igual
#   2h. Python (Informe_Ranking_IPTV\ejecutar_todo.py --sin-correo) + reportes\generar_iptv.js -> iptv.html
#       (boton en supervisor.html); si falla, se deja la version anterior y el resto se publica igual
#   3. commit + push de index.html, supervisor.html, reiteradas.html, vecino.html, brecha.html, graficos.html, autochequeo.html, recursos.html e iptv.html (reintenta)
#   4. espera a que el sitio publico muestre la version nueva
#   5. notificacion de Windows con el resultado (exito o error)
# Cada corrida deja su detalle en logs\actualizacion_AAAA-MM-DD.log

$ErrorActionPreference = "Continue"
Set-Location -LiteralPath $PSScriptRoot

$SitioUrl = "https://supervisionenaccion-stack.github.io/indicadores-tecnicos/"
$Node = "C:\Program Files\nodejs\node.exe"
$Git = "C:\Program Files\Git\cmd\git.exe"

$LogDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("actualizacion_" + (Get-Date -Format "yyyy-MM-dd") + ".log")

function Log($texto) {
  $linea = "[" + (Get-Date -Format "HH:mm:ss") + "] " + $texto
  Add-Content -LiteralPath $LogFile -Value $linea -Encoding UTF8
}

function Notificar($titulo, $mensaje) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $esc = { param($s) [System.Security.SecurityElement]::Escape($s) }
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml("<toast duration=`"long`" activationType=`"protocol`" launch=`"$SitioUrl`"><visual><binding template=`"ToastGeneric`"><text>$(& $esc $titulo)</text><text>$(& $esc $mensaje)</text></binding></visual></toast>")
    $appId = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
  } catch {
    Log ("No se pudo mostrar la notificacion: " + $_.Exception.Message)
  }
}

function Correr($exe, [string[]]$argumentos) {
  $salida = & $exe @argumentos 2>&1 | ForEach-Object { "$_" }
  foreach ($l in $salida) { Log ("    " + $l) }
  return @{ Codigo = $LASTEXITCODE; Salida = ($salida -join "`n") }
}

# Avisa a la pagina de estado (C:\Bases_Tigo\registrar_estado.js). Nunca detiene la actualizacion.
function Estado($clave, $estado, $detalle) {
  try {
    & $Node "C:\Bases_Tigo\registrar_estado.js" $clave $estado $detalle 2>&1 | Out-Null
    $bat = "C:\Bases_Tigo\estado_web\Actualizar_Estado.bat"
    if (Test-Path -LiteralPath $bat) { & cmd.exe /c "`"$bat`"" 2>&1 | Out-Null }
  } catch {
    Log ("No se pudo registrar el estado: " + $_.Exception.Message)
  }
}

function Fallar($paso, $detalle) {
  Log ("ERROR en " + $paso + ": " + $detalle)
  Notificar "Portal NO actualizado" ("Fallo en " + $paso + ". El sitio sigue con la version anterior. Detalle en logs\" + (Split-Path $LogFile -Leaf))
  Estado "portal_vtr" "ERROR" ("fallo en " + $paso + ": " + $detalle)
  exit 1
}

Log "===== Inicio actualizacion automatica ====="

# 1. Generar (procesa todo en este equipo)
Log "1/4 Generando portal desde la base de datos..."
$r = Correr $Node @("generar_portal.js")
if ($r.Codigo -ne 0) { Fallar "la generacion (base de datos)" "generar_portal.js termino con error" }

# 2. Validar antes de publicar
Log "2/4 Validando los archivos generados..."
$r = Correr $Node @("validar_portal.js")
if ($r.Codigo -ne 0) {
  # Se descartan los HTML generados para no dejar una version mala lista para subir.
  Correr $Git @("checkout", "--", "index.html", "supervisor.html") | Out-Null
  Fallar "la validacion" (($r.Salida -split "`n" | Select-Object -Skip 1) -join " ")
}
$resumen = ($r.Salida -split "`n" | Where-Object { $_ -like "VALIDACION OK*" }) -replace "^VALIDACION OK: ", ""
# Hash sin los CR de fin de linea: git (autocrlf) deja el archivo local con CRLF y
# GitHub Pages lo sirve con LF; desde el 31-10-2026 eso hacia fallar la confirmacion
# en linea aunque el sitio ya mostraba la version nueva.
function HashSinCR([byte[]]$bytes) {
  $sinCR = [byte[]]($bytes | Where-Object { $_ -ne 13 })
  return ([BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($sinCR))).Replace("-", "")
}
$hashLocal = HashSinCR ([System.IO.File]::ReadAllBytes((Join-Path $PSScriptRoot "index.html")))

# 2a. Datos de cada tecnico a Supabase: el index.html publico va sin ellos y el
# portal los pide con el ID. Si no se suben, no se publica nada (los tecnicos
# siguen viendo los datos de la ultima carga buena).
Log "2a/4 Subiendo los datos de los tecnicos a Supabase..."
$r = Correr $Node @("reportes\subir_datos_tecnicos.js")
if ($r.Codigo -ne 0) {
  Correr $Git @("checkout", "--", "index.html", "supervisor.html") | Out-Null
  Fallar "la subida de datos a Supabase" "reportes\subir_datos_tecnicos.js termino con error"
}

# 2b. Reporte de reiteradas del mes (se valida solo antes de escribir). Es un
# complemento: si falla, NO bloquea la publicacion del portal.
Log "2b/4 Generando reporte de reiteradas del mes..."
$r = Correr $Node @("reportes\generar_reiteradas.js")
$avisoReiteradas = ""
if ($r.Codigo -ne 0) {
  Log "AVISO: reiteradas.html no se actualizo hoy; queda publicada la version anterior."
  Correr $Git @("checkout", "--", "reiteradas.html") | Out-Null
  $avisoReiteradas = " (reiteradas NO actualizado, ver log)"
}

# 2c. Reporte de consulta de estado vecino (se valida solo antes de escribir).
# Tambien es un complemento: si falla, NO bloquea la publicacion del portal.
Log "2c/4 Generando reporte de consulta de estado vecino..."
$r = Correr $Node @("reportes\generar_vecino.js")
if ($r.Codigo -ne 0) {
  Log "AVISO: vecino.html no se actualizo hoy; queda publicada la version anterior."
  Correr $Git @("checkout", "--", "vecino.html") | Out-Null
  $avisoReiteradas += " (consulta vecino NO actualizado, ver log)"
}

# 2d. Brecha a la meta de RGU (boton en supervisor.html). Complemento: si
# falla, NO bloquea la publicacion del portal.
Log "2d/4 Generando brecha a la meta de RGU..."
$r = Correr $Node @("reportes\generar_brecha.js")
if ($r.Codigo -ne 0) {
  Log "AVISO: brecha.html no se actualizo hoy; queda publicada la version anterior."
  Correr $Git @("checkout", "--", "brecha.html") | Out-Null
  $avisoReiteradas += " (brecha RGU NO actualizada, ver log)"
}

# 2e. Graficos del equipo (boton en supervisor.html). Complemento: si falla,
# NO bloquea la publicacion del portal.
Log "2e/4 Generando graficos del equipo..."
$r = Correr $Node @("reportes\generar_graficos.js")
if ($r.Codigo -ne 0) {
  Log "AVISO: graficos.html no se actualizo hoy; queda publicada la version anterior."
  Correr $Git @("checkout", "--", "graficos.html") | Out-Null
  $avisoReiteradas += " (graficos NO actualizados, ver log)"
}

# 2f. Estadistica del autochequeo de herramientas (boton en supervisor.html; lee el
# Excel de Forms sincronizado en OneDrive). Complemento: si falla, NO bloquea.
Log "2f/4 Generando estadistica del autochequeo..."
$r = Correr $Node @("reportes\generar_autochequeo.js")
if ($r.Codigo -ne 0) {
  Log "AVISO: autochequeo.html no se actualizo hoy; queda publicada la version anterior."
  Correr $Git @("checkout", "--", "autochequeo.html") | Out-Null
  $avisoReiteradas += " (autochequeo NO actualizado, ver log)"
  Estado "autochequeo" "ERROR" "autochequeo.html no se actualizo, queda la version anterior"
} else {
  Estado "autochequeo" "OK" "autochequeo.html actualizado"
}

# 2g. Recursos del equipo (videos, fotos y registros; boton en supervisor.html).
Log "2g/4 Generando recursos del equipo..."
$r = Correr $Node @("reportes\generar_recursos.js")
if ($r.Codigo -ne 0) {
  Log "AVISO: recursos.html no se actualizo hoy; queda publicada la version anterior."
  Correr $Git @("checkout", "--", "recursos.html") | Out-Null
  $avisoReiteradas += " (recursos NO actualizados, ver log)"
  Estado "recursos" "ERROR" "recursos.html no se actualizo, queda la version anterior"
} else {
  Estado "recursos" "OK" "recursos.html actualizado"
}

# 2h. Calidad de instalacion IPTV (boton en supervisor.html). El flujo en Python
# (C:\Bases_Vtr\Informe_Ranking_IPTV) baja el Power BI con Edge y deja Envios\iptv_datos.json;
# despues se genera iptv.html cifrada. Complemento: si falla la descarga se usa el ultimo
# archivo (la pagina muestra la fecha de los datos); si falla el generador, queda la version anterior.
Log "2h/4 Calidad de instalacion IPTV (Python + Power BI)..."
$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) { $Python = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe" }
$r = Correr $Python @("-W", "ignore", "C:\Bases_Vtr\Informe_Ranking_IPTV\ejecutar_todo.py", "--sin-correo")
if ($r.Codigo -ne 0) {
  Log "AVISO: no se pudo bajar el Power BI de IPTV; se usan los ultimos datos guardados."
  $avisoReiteradas += " (IPTV: Power BI no se pudo bajar, datos anteriores)"
}
$r = Correr $Node @("reportes\generar_iptv.js")
if ($r.Codigo -ne 0) {
  Log "AVISO: iptv.html no se actualizo hoy; queda publicada la version anterior."
  Correr $Git @("checkout", "--", "iptv.html") | Out-Null
  $avisoReiteradas += " (IPTV NO actualizado, ver log)"
  Estado "iptv" "ERROR" "iptv.html no se actualizo, queda la version anterior"
} else {
  Estado "iptv" "OK" "iptv.html actualizado"
}

# 3. Publicar
Log "3/4 Publicando en GitHub..."
$paginas = @("index.html", "supervisor.html", "reiteradas.html", "vecino.html", "brecha.html", "graficos.html", "autochequeo.html", "recursos.html")
if (Test-Path -LiteralPath "iptv.html") { $paginas += "iptv.html" }
Correr $Git (@("add") + $paginas) | Out-Null
$r = Correr $Git @("diff", "--cached", "--quiet")
if ($r.Codigo -eq 0) {
  Log "No hay cambios nuevos respecto de lo ya publicado."
  Notificar "Portal sin cambios" "Los datos de hoy son iguales a los ya publicados. $resumen"
  if ($avisoReiteradas) { Estado "portal_vtr" "ERROR" ("sin cambios; con avisos:" + $avisoReiteradas) } else { Estado "portal_vtr" "OK" "sin cambios: los datos de hoy ya estaban publicados" }
  exit 0
}
$r = Correr $Git @("commit", "-m", ("Actualizar portal (automatico) " + (Get-Date -Format "dd-MM-yyyy HH:mm")))
if ($r.Codigo -ne 0) { Fallar "el commit" "git commit fallo" }

$subido = $false
foreach ($intento in 1..3) {
  $r = Correr $Git @("push")
  if ($r.Codigo -eq 0) { $subido = $true; break }
  Log ("Push fallo (intento " + $intento + "), reintentando en 30 s...")
  Start-Sleep -Seconds 30
}
if (-not $subido) { Fallar "la subida a GitHub" "el commit quedo local pero no se pudo subir (revisar internet / credencial)" }

# 4. Confirmar que el sitio publico ya muestra la version nueva
Log "4/4 Esperando que el sitio publico se actualice..."
$enLinea = $false
# Si GitHub cancela la publicacion (le pasa cuando su servicio Actions anda
# mal), se pide de nuevo: hasta 4 rondas de 10 minutos.
$Gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
# La cuenta activa de gh puede ser otra (JhonasVK no tiene permiso de escritura aqui y GitHub
# responde 404 al pedir la publicacion). Se usa la cuenta duena del repositorio, solo para ese pedido.
$TokenPortal = $null
if ($Gh) { try { $TokenPortal = (& $Gh auth token --user supervisionenaccion-stack 2>$null) | Select-Object -First 1 } catch { } }
foreach ($ronda in 1..4) {
  if ($ronda -gt 1) {
    if ($Gh) {
      Log ("Sin publicar todavia: se pide a GitHub publicar de nuevo (intento " + $ronda + ").")
      $tokenAnterior = $env:GH_TOKEN
      if ($TokenPortal) { $env:GH_TOKEN = $TokenPortal }
      Correr $Gh @("api", "-X", "POST", "repos/supervisionenaccion-stack/indicadores-tecnicos/pages/builds") | Out-Null
      $env:GH_TOKEN = $tokenAnterior
    } else {
      Log "Sin publicar todavia y sin gh instalado para pedirlo de nuevo; se sigue esperando."
    }
  }
  foreach ($i in 1..20) {
    Start-Sleep -Seconds 30
    try {
      # Se compara el archivo publicado byte a byte (hash) con el generado aqui.
      $resp = Invoke-WebRequest -UseBasicParsing -Uri ($SitioUrl + "index.html?nc=" + [guid]::NewGuid()) -Headers @{ "Cache-Control" = "no-cache" } -TimeoutSec 30
      $hashEnLinea = HashSinCR $resp.RawContentStream.ToArray()
      if ($hashEnLinea -eq $hashLocal) { $enLinea = $true; break }
    } catch {
      Log ("Consulta al sitio fallo: " + $_.Exception.Message)
    }
  }
  if ($enLinea) { break }
}
if (-not $enLinea) {
  Fallar "la confirmacion en linea" "se subio a GitHub y se pidio publicar 4 veces, pero el sitio no mostro la version nueva en 40 minutos (revisar githubstatus.com). Los tecnicos igual ven sus datos de hoy: vienen de Supabase"
}

Log ("OK: publicado y visible en linea. " + $resumen + $avisoReiteradas)
Notificar "Portal actualizado y publicado" ($resumen + $avisoReiteradas)
# Una actualizacion con complementos sin actualizar se marca ERROR en la pagina de estado, para que se note.
if ($avisoReiteradas) { Estado "portal_vtr" "ERROR" ("publicado, pero con avisos:" + $avisoReiteradas) } else { Estado "portal_vtr" "OK" "portal publicado y visible en linea" }
exit 0
