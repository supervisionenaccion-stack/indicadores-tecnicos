# Publica la pagina de auditorias de terreno (auditorias.html) del portal.
# La llama la tarea de las 8:45 del proyecto AuditoriasTerreno
# (actualizar_programado.bat), justo despues de descargar las respuestas del
# formulario, para que la pagina tenga las auditorias del dia anterior.
#   1. reportes\generar_auditorias.js -> auditorias.html cifrada (valida antes de escribir)
#   2. validar que ninguna pagina de supervisores quede sin cifrar
#   3. commit solo de auditorias.html + push (reintenta)
# Sale con codigo 1 si algo falla; el sitio queda con la version anterior.
# Deja su detalle en logs\auditorias_AAAA-MM-DD.log

$ErrorActionPreference = "Continue"
Set-Location -LiteralPath $PSScriptRoot

$Node = "C:\Program Files\nodejs\node.exe"
$Git = "C:\Program Files\Git\cmd\git.exe"
$LogDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("auditorias_" + (Get-Date -Format "yyyy-MM-dd") + ".log")

function Log($texto) {
  $linea = "[" + (Get-Date -Format "HH:mm:ss") + "] " + $texto
  Add-Content -LiteralPath $LogFile -Value $linea -Encoding UTF8
  Write-Host $linea
}
function Correr($exe, [string[]]$argumentos) {
  $salida = & $exe @argumentos 2>&1 | ForEach-Object { "$_" }
  foreach ($l in $salida) { Log ("    " + $l) }
  return $LASTEXITCODE
}
function Fallar($detalle) {
  Log ("ERROR: " + $detalle)
  Correr $Git @("checkout", "--", "auditorias.html") | Out-Null
  exit 1
}

Log "===== Auditorias de terreno ====="
if ((Correr $Node @("reportes\generar_auditorias.js")) -ne 0) { Fallar "no se genero auditorias.html" }
if ((Correr $Node @("validar_portal.js")) -ne 0) { Fallar "la validacion del portal no paso" }

Correr $Git @("add", "auditorias.html") | Out-Null
if ((Correr $Git @("diff", "--cached", "--quiet", "--", "auditorias.html")) -eq 0) {
  Log "Sin cambios respecto de lo publicado."
  exit 0
}
# Solo se confirma auditorias.html, aunque haya otros cambios a medio hacer en la carpeta.
if ((Correr $Git @("commit", "-m", ("Actualizar auditorias de terreno " + (Get-Date -Format "dd-MM-yyyy HH:mm")), "--", "auditorias.html")) -ne 0) { Fallar "git commit fallo" }
foreach ($intento in 1..3) {
  if ((Correr $Git @("push")) -eq 0) { Log "OK: auditorias.html publicada."; exit 0 }
  Log ("Push fallo (intento " + $intento + "), reintentando en 30 s...")
  Start-Sleep -Seconds 30
}
Log "ERROR: el commit quedo local pero no se pudo subir (revisar internet / credencial)"
exit 1
