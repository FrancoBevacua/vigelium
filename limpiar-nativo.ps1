# Securia — borra el estado de compilacion C++ de las librerias nativas.
#
# Cuando se cambia la version de una libreria con codigo nativo (worklets,
# reanimated, screens...), las carpetas .cxx que dejo la compilacion anterior
# siguen apuntando a rutas que ya no existen, y ninja corta con:
#     error: '...libworklets.so', needed by '...', missing and no known rule to make it
# Esto lo resuelve. Despues hay que compilar de nuevo: los .so se rehacen.
#
# Uso, parado en la carpeta del proyecto:
#     powershell -ExecutionPolicy Bypass -File .\limpiar-nativo.ps1

$ErrorActionPreference = 'Continue'
$raiz = $PSScriptRoot

$paquetes = @(
  'expo-modules-core',
  'react-native-worklets',
  'react-native-reanimated',
  'react-native-screens',
  'react-native-svg',
  'react-native-gesture-handler',
  'react-native-safe-area-context',
  'react-native'
)

$borrados = 0
foreach ($p in $paquetes) {
  foreach ($sub in @('android\.cxx', 'android\build', 'ReactAndroid\.cxx')) {
    $d = Join-Path $raiz ("node_modules\" + $p + "\" + $sub)
    if (Test-Path $d) {
      Remove-Item $d -Recurse -Force -ErrorAction SilentlyContinue
      if (-not (Test-Path $d)) { Write-Host ('  borrado  ' + $p + '\' + $sub) -ForegroundColor DarkGray; $borrados++ }
      else { Write-Host ('  NO se pudo borrar  ' + $d) -ForegroundColor Yellow }
    }
  }
}

foreach ($d in @((Join-Path $raiz 'android\app\.cxx'), (Join-Path $raiz 'android\.cxx'))) {
  if (Test-Path $d) {
    Remove-Item $d -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $d)) { Write-Host ('  borrado  ' + $d) -ForegroundColor DarkGray; $borrados++ }
  }
}

Write-Host ''
Write-Host ("Carpetas de compilacion nativa borradas: " + $borrados) -ForegroundColor Green
Write-Host 'Se rehacen solas en la proxima compilacion (tarda unos minutos mas).'
Write-Host ''
Write-Host 'Ahora:' -ForegroundColor Cyan
Write-Host '    cd android'
Write-Host '    .\gradlew assembleRelease'
Write-Host ''
