# Securia — consigue un JDK 17 sin depender de Android Studio.
#
# Prueba, en orden:
#   1) Si ya hay un JDK 17-21 en la PC, no descarga nada.
#   2) winget (viene con Windows 10/11).
#   3) Descarga directa del ZIP oficial de Eclipse Temurin y lo descomprime
#      en tu carpeta de usuario. No necesita permisos de administrador ni
#      instala nada en el sistema.
#
# Al final deja Gradle apuntando a ese JDK.
#
# Uso, parado en la carpeta del proyecto:
#     powershell -ExecutionPolicy Bypass -File .\instalar-jdk17.ps1

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'   # sin esto Invoke-WebRequest va lentisimo

$raiz = $PSScriptRoot

function VersionJava([string]$ruta) {
  if (-not $ruta) { return 0 }
  $exe = Join-Path $ruta 'bin\java.exe'
  if (-not (Test-Path $exe)) { return 0 }
  try { $salida = (& $exe -version 2>&1 | Out-String) } catch { return 0 }
  if ($salida -match 'version\s+"?(\d+)') { return [int]$matches[1] }
  return 0
}

function BuscarJdk {
  $cand = New-Object System.Collections.ArrayList
  foreach ($c in @(
    'C:\Program Files\Android\Android Studio\jbr',
    'C:\Program Files\Android\Android Studio Preview\jbr',
    (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr'),
    (Join-Path $env:LOCALAPPDATA 'Securia\jdk17'),
    $env:JAVA_HOME
  )) { if ($c) { [void]$cand.Add($c) } }

  foreach ($base in @('C:\Program Files\Java', 'C:\Program Files\Eclipse Adoptium',
                      'C:\Program Files\Microsoft', 'C:\Program Files\Zulu',
                      'C:\Program Files\Amazon Corretto',
                      (Join-Path $env:LOCALAPPDATA 'Securia'),
                      (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium'))) {
    if (Test-Path $base) {
      foreach ($d in (Get-ChildItem $base -Directory -ErrorAction SilentlyContinue)) {
        [void]$cand.Add($d.FullName)
      }
    }
  }

  $mejor = $null; $mejorV = 0
  foreach ($c in $cand) {
    $v = VersionJava $c
    if ($v -ge 17 -and $v -le 21) {
      if (-not $mejor -or $v -lt $mejorV) { $mejor = $c; $mejorV = $v }
    }
  }
  if ($mejor) { return @($mejor, $mejorV) }
  return $null
}

# ---------------------------------------------------------------- 1) ya lo tenes
Write-Host ''
Write-Host 'Buscando un JDK 17-21 en la PC...'
$hay = BuscarJdk
if ($hay) {
  Write-Host ('Ya tenes uno: ' + $hay[0] + '  (Java ' + $hay[1] + ')') -ForegroundColor Green
  Write-Host 'No hace falta descargar nada.'
  & powershell -ExecutionPolicy Bypass -File (Join-Path $raiz 'configurar-sdk.ps1')
  exit 0
}

# ---------------------------------------------------------------- 2) winget
$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
  Write-Host ''
  Write-Host 'Probando con winget (el instalador de Windows)...' -ForegroundColor Cyan
  & winget install --id EclipseAdoptium.Temurin.17.JDK -e --accept-source-agreements --accept-package-agreements
  $hay = BuscarJdk
  if ($hay) {
    Write-Host ('Instalado en: ' + $hay[0] + '  (Java ' + $hay[1] + ')') -ForegroundColor Green
    & powershell -ExecutionPolicy Bypass -File (Join-Path $raiz 'configurar-sdk.ps1')
    exit 0
  }
  Write-Host 'winget no pudo. Sigo con la descarga directa.' -ForegroundColor Yellow
}

# ---------------------------------------------------------------- 3) ZIP oficial
$destino = Join-Path $env:LOCALAPPDATA 'Securia\jdk17'
$zip = Join-Path $env:TEMP 'temurin-17.zip'
$url = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse'

Write-Host ''
Write-Host 'Descargando el JDK 17 de Eclipse Temurin (unos 190 MB)...' -ForegroundColor Cyan
Write-Host ('  desde ' + $url)
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

try {
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
} catch {
  Write-Host ''
  Write-Host 'No se pudo descargar.' -ForegroundColor Red
  Write-Host ('Motivo: ' + $_.Exception.Message)
  Write-Host ''
  Write-Host 'Bajalo a mano desde:'
  Write-Host '    https://adoptium.net/temurin/releases?version=17&os=windows&arch=x64'
  Write-Host 'Elegi el paquete .zip (JDK, x64), descomprimilo donde quieras y despues:'
  Write-Host '    powershell -ExecutionPolicy Bypass -File .\configurar-sdk.ps1 -Jdk "C:\ruta\del\jdk-17..."'
  exit 1
}

if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 50MB) {
  Write-Host 'La descarga quedo incompleta. Volve a intentar.' -ForegroundColor Red
  exit 1
}

Write-Host 'Descomprimiendo...'
if (Test-Path $destino) { Remove-Item $destino -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $destino -Force | Out-Null
Expand-Archive -Path $zip -DestinationPath $destino -Force
Remove-Item $zip -Force -ErrorAction SilentlyContinue

# el zip trae adentro una carpeta tipo jdk-17.0.18+7
$dentro = Get-ChildItem $destino -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
$jdk = if ($dentro) { $dentro.FullName } else { $destino }
$ver = VersionJava $jdk

if ($ver -lt 17) {
  Write-Host 'Se descomprimio pero no encuentro java.exe adentro. Revisá:' -ForegroundColor Red
  Write-Host ('    ' + $destino)
  exit 1
}

Write-Host ''
Write-Host ('JDK 17 listo en: ' + $jdk + '  (Java ' + $ver + ')') -ForegroundColor Green
Write-Host 'Queda solo para este proyecto: no toca el Java del sistema ni el PATH.'
Write-Host ''

& powershell -ExecutionPolicy Bypass -File (Join-Path $raiz 'configurar-sdk.ps1') -Jdk $jdk
