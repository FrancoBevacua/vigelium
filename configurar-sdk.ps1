# Securia — deja el proyecto listo para compilar en esta PC.
#
#   1) Escribe android\local.properties con la ruta del SDK de Android.
#   2) Escribe org.gradle.java.home en android\gradle.properties apuntando a un
#      JDK 17-21, porque el plugin de Android todavia no soporta JDK 24 o mayor.
#
# Uso, parado en la carpeta del proyecto:
#     powershell -ExecutionPolicy Bypass -File .\configurar-sdk.ps1
#
# Si el SDK o el JDK estan en un lugar raro, se pueden pasar a mano:
#     powershell -ExecutionPolicy Bypass -File .\configurar-sdk.ps1 -Sdk "D:\Android\Sdk" -Jdk "C:\Java\jdk-17"

param(
  [string]$Sdk = '',
  [string]$Jdk = '',
  [string]$Ruta = ''      # alias viejo de -Sdk
)

$ErrorActionPreference = 'Continue'
if ($Ruta -and -not $Sdk) { $Sdk = $Ruta }

$raiz = $PSScriptRoot
$dirAndroid = Join-Path $raiz 'android'
if (-not (Test-Path $dirAndroid)) {
  Write-Host "No encuentro la carpeta android\ . Correme parado en la carpeta del proyecto." -ForegroundColor Red
  exit 1
}

# ------------------------------------------------------------------ SDK
$candSdk = @(
  $Sdk,
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
  (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'),
  'C:\Android\Sdk',
  'D:\Android\Sdk'
) | Where-Object { $_ }

$sdkOk = $null
foreach ($c in $candSdk) {
  if ((Test-Path $c) -and ((Test-Path (Join-Path $c 'platform-tools')) -or (Test-Path (Join-Path $c 'platforms')))) {
    $sdkOk = (Resolve-Path $c).Path
    break
  }
}

if (-not $sdkOk) {
  Write-Host ''
  Write-Host 'No encontre el SDK de Android.' -ForegroundColor Red
  Write-Host 'Abri Android Studio -> More Actions -> SDK Manager y copia la ruta de'
  Write-Host '"Android SDK Location". Despues corre:'
  Write-Host '    powershell -ExecutionPolicy Bypass -File .\configurar-sdk.ps1 -Sdk "C:\ruta\al\Sdk"'
  exit 1
}

Set-Content -Path (Join-Path $dirAndroid 'local.properties') `
  -Value ('sdk.dir=' + ($sdkOk -replace '\\', '/')) -Encoding ASCII
Write-Host ''
Write-Host ('SDK de Android : ' + $sdkOk) -ForegroundColor Green

# ------------------------------------------------------------------ JDK
function VersionJava([string]$ruta) {
  if (-not $ruta) { return 0 }
  $exe = Join-Path $ruta 'bin\java.exe'
  if (-not (Test-Path $exe)) { return 0 }
  try {
    $salida = (& $exe -version 2>&1 | Out-String)
  } catch { return 0 }
  if ($salida -match 'version\s+"?(\d+)') { return [int]$matches[1] }
  return 0
}

$candJdk = New-Object System.Collections.ArrayList
foreach ($c in @(
  $Jdk,
  'C:\Program Files\Android\Android Studio\jbr',
  'C:\Program Files\Android\Android Studio Preview\jbr',
  (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr'),
  (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio Preview\jbr'),
  $env:JAVA_HOME
)) { if ($c) { [void]$candJdk.Add($c) } }

foreach ($base in @('C:\Program Files\Java', 'C:\Program Files\Eclipse Adoptium',
                    'C:\Program Files\Microsoft', 'C:\Program Files\Zulu',
                    'C:\Program Files\Amazon Corretto',
                    (Join-Path $env:LOCALAPPDATA 'Securia'),
                    (Join-Path $env:LOCALAPPDATA 'Securia\jdk17'),
                    (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium'))) {
  if (Test-Path $base) {
    foreach ($d in (Get-ChildItem $base -Directory -ErrorAction SilentlyContinue)) {
      [void]$candJdk.Add($d.FullName)
    }
  }
}

$jdkOk = $null; $jdkVer = 0
foreach ($c in $candJdk) {
  $v = VersionJava $c
  if ($v -ge 17 -and $v -le 21) {
    # preferimos el mas bajo dentro del rango soportado
    if (-not $jdkOk -or $v -lt $jdkVer) { $jdkOk = (Resolve-Path $c).Path; $jdkVer = $v }
  }
}

$gp = Join-Path $dirAndroid 'gradle.properties'
$lineas = @()
if (Test-Path $gp) {
  $lineas = @(Get-Content $gp | Where-Object {
    $_ -notmatch '^\s*org\.gradle\.java\.home' -and
    $_ -notmatch '^\s*org\.gradle\.jvmargs' -and
    $_ -notmatch '^# Securia:'
  })
  # prebuild deja 2 GB de heap y 512 MB de metaspace: al bundlear se queda corto
  $lineas += '# Securia: memoria para el demonio de Gradle'
  $lineas += 'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8'
}

if ($jdkOk) {
  $lineas += '# Securia: JDK que usa Gradle (lo escribe configurar-sdk.ps1)'
  $lineas += ('org.gradle.java.home=' + ($jdkOk -replace '\\', '/'))
  Set-Content -Path $gp -Value $lineas -Encoding ASCII
  Write-Host ('JDK para Gradle: ' + $jdkOk + '  (Java ' + $jdkVer + ')') -ForegroundColor Green
} else {
  Set-Content -Path $gp -Value $lineas -Encoding ASCII
  $actual = VersionJava $env:JAVA_HOME
  Write-Host ''
  Write-Host 'No encontre un JDK 17 a 21 en esta PC.' -ForegroundColor Yellow
  if ($actual -ge 22) {
    Write-Host ("El Java que tenes es la version $actual, y el plugin de Android todavia no la soporta.")
  }
  Write-Host 'Podes conseguirlo sin tocar Android Studio corriendo, en la carpeta del proyecto:'
  Write-Host ''
  Write-Host '    powershell -ExecutionPolicy Bypass -File .\instalar-jdk17.ps1' -ForegroundColor Cyan
  Write-Host ''
  Write-Host 'Ese script lo baja de Eclipse Temurin, lo deja en tu carpeta de usuario'
  Write-Host 'y vuelve a llamar a este. No necesita permisos de administrador.'
  Write-Host ''
  exit 1
}

# el demonio de Gradle guarda el JDK viejo en memoria: hay que bajarlo
Push-Location $dirAndroid
& .\gradlew.bat --stop | Out-Null
Pop-Location

Write-Host ''
Write-Host 'Listo. Ahora si:' -ForegroundColor Cyan
Write-Host '    cd android'
Write-Host '    .\gradlew assembleRelease'
Write-Host ''
