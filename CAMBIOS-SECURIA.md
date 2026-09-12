# Securia 1.1.0

## Cambios de esta versión

- Cuentas locales por legajo y PIN en el teléfono compartido del puesto. Las novedades son comunes a todos los turnos y conservan el autor.
- Inicio y cierre de turno con asiento de ingreso y egreso. Las novedades del turno cerrado quedan de sólo lectura, también para su autor. Las operaciones compuestas se guardan juntas; una validación fallida no deja registros parciales.
- Informe general prioritario, con alta, edición y eliminación durante el turno propio. Períodos de 24 horas y encabezados de fecha al pasar medianoche.
- Las aperturas individuales no pasan al informe general. Sólo se incorpora la apertura completa de los portones de playa entre las 07:30 y las 12:00, con una lista de nombres. El resumen queda fijado al cerrar el turno.
- PDF con texto negro y evidencia fotográfica a color, siguiendo el encabezado y disposición del ejemplo. Cierre por defecto únicamente cuando no hubo novedades trascendentales.
- Lectura de una foto del libro físico mediante IA, con revisión de fechas, horas y texto antes de importar. Se pueden excluir filas ilegibles y adjuntar la foto como evidencia.
- Un solo botón de redacción con IA, estado de avance, configuración accesible y errores visibles dentro del formulario. Se conserva el borrador si la respuesta falla o altera datos del informe.
- Dictado mediante el servicio de reconocimiento de voz del teléfono, con transcripción visible, finalización y cancelación.
- Importación del diagrama del supervisor con revisión de personas y fechas; al guardar se abre el mes y el guardia importados para mostrar el calendario.
- Adicionales policiales e ingresos/egresos de guardias con asiento automático en el libro y el informe general.
- Recorridos separados para locales abiertos y cerrados, catálogo de horarios y observaciones. Al finalizar se prepara el mensaje en WhatsApp: el guardia selecciona el contacto si no configuró un número y toca «Enviar».
- Las secciones muestran primero la lista; los formularios se abren al tocar el botón de agregar. Tarjetas compactas con padding y separadores.
- Se mantienen la presentación azul SECURIA, la credencial interactiva del perfil y el prefijo de cuatro dígitos para precintos.
- La restauración de respaldos está reservada a administración y conserva las cuentas y el historial protegido.

## Uso en el teléfono del puesto

1. Cada guardia se registra con sus datos y PIN. Una cuenta de la versión anterior sin PIN puede configurarlo usando su legajo y fecha de nacimiento registrada.
2. Iniciar sesión y tocar «Iniciar turno». El guardia anterior debe cerrar su turno antes del relevo.
3. Registrar novedades y finalizar con «Cerrar turno». El siguiente guardia inicia sesión con su cuenta y consulta el mismo informe.
4. En Ajustes se configura la clave del proveedor de IA. La redacción y lectura de documentos requieren conexión y un proveedor compatible. El dictado usa el servicio de voz de Android.
5. En Locales se puede guardar el número de inmobiliaria con código de país y área. WhatsApp siempre requiere tocar «Enviar».

## Verificación

- TypeScript sin errores y 25 pruebas de regresión aprobadas: relevo entre cuentas, protección del historial, operaciones atómicas, precintos, fechas, aperturas, OCR, cronogramas, errores de IA, WhatsApp y PDF.
- PDF de ejemplo renderizado e inspeccionado: fechas separadas, texto negro e imagen RGB conservada.
- Pantallas de ingreso y registro comprobadas en la versión web.
- Las pruebas de IA usan respuestas simuladas. No se probó la conexión con una clave real ni el dictado, la cámara o WhatsApp en un teléfono físico.
- Paquete Android: `ar.com.securia.app`, versión `1.1.0`, código `3`.

## Compilación

Con Android generado y el SDK configurado, desde `android`:

```powershell
.\gradlew.bat :app:assembleRelease --no-daemon --console=plain --max-workers=2
```

Salida nativa: `android/app/build/outputs/apk/release/app-release.apk`.
La APK entregable se copia a `Securia.apk` después de verificar firma y alineación.

## APK entregada

Compilación Android completada: `BUILD SUCCESSFUL in 31m 25s`.

- Archivo: `Securia.apk` (117.434.569 bytes).
- Firma verificada y coincidente con la APK anterior; permite actualizar sin desinstalar.
- Alineación de 16 KB verificada. Android 7.0 o posterior; ARM y x86 de 32 y 64 bits.
- SHA-256: `A3C9D655CC1D5D5BE87F71E309EF3A65239BE24CF1C47BF5BF8FD572D3BC604A`.
- Detalle: `output/apk/verificacion-1.1.0.json`.
- Respaldo 1.0.1: `output/apk/Securia-1.0.1-respaldo.apk`.
