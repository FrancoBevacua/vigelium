# VIGELIUM · Desarrollo

Aplicación Android y panel administrativo para el servicio de vigilancia. Desarrollada por Franco Daniel Bevacua. Repositorio privado, rama `develop`. Versión móvil **1.6.0**, código **10**, identificador `ar.com.securia.app`.

## Contenido

- `app/`, `src/`, `assets/`: aplicación móvil con Expo y React Native.
- `admin/`: panel web con React, Vite y API para Vercel.
- `nube/`, `supabase/migrations/`: servicio compartido, migraciones y documentación.
- `tests/`: pruebas de dominio, PDF, autenticación, dictado y sincronización.
- Scripts PowerShell: configuración y compilación de Android.

## Instalar la actualización

Instalar la APK sobre la versión anterior, sin desinstalar ni borrar datos. Las cuentas existentes se conservan. Los teléfonos autorizados comparten las cuentas y el informe del objetivo. El registro y el ingreso con DNI/PIN requieren Internet.

Cada novedad permite seleccionar al vigilador que debe firmar. La cuenta que realiza la carga se conserva por separado para controlar la edición durante el turno. Inicio saluda según el sexo indicado en el perfil, sin mostrar el nombre. Los perfiles anteriores pueden completar ese dato desde su editor.

## Preparar y compilar el móvil

### Cambios de 1.6.0

- Cola cifrada en SQLite propio (`vigelium-datos.db`), con transacciones atómicas y `synchronous=FULL`. Se elimina el límite de AsyncStorage Android para las novedades y evidencias. La migración verifica la copia antes de retirar el valor anterior; una escritura fallida conserva el dato previo.
- Guardado local sin demora programada. Novedades, informes, importaciones y cierre de turno esperan la escritura local; la sincronización tiene una cola independiente y reintenta cada 30 segundos en primer plano o al volver a la app. Los errores de disco quedan visibles.
- Formularios con desplazamiento automático al cursor cuando aparece el teclado, incluidos modales, ingreso y registro.
- **Más → Recordatorios** permite elegir un calendario del teléfono, crear avisos, editarlos y eliminarlos. Los cambios externos se releen al volver. Google sincroniza los eventos si se elige un calendario de esa cuenta y la sincronización está habilitada. El calendario local funciona sólo en ese teléfono. Estos recordatorios personales no se envían a la base corporativa.
- Informes de 12 o 24 horas calculados desde la fecha de entrega: 07→19, 19→07 o 19→19. El texto y el panel web incluyen los extremos del período. La hora inicial se incluye y la final pertenece al período siguiente.

Verificación automatizada: `npm test`, `npm run typecheck` y `npm --prefix admin run build`. Las pruebas ejecutan SQLite real con valores mayores a 10 MB, fallos `SQLITE_FULL`, migraciones, colas concurrentes, alarmas de calendario y límites de períodos. Los adaptadores Android/iOS de teclado y calendario requieren además una prueba en dispositivo con permisos y cuenta de calendario.

La actualización incluye módulos nativos nuevos: requiere recompilar e instalar la APK, no alcanza con actualizar JavaScript. Los cambios del panel web requieren publicar su build por el procedimiento habitual.

Requisitos: Node.js, Android SDK 36 y JDK 17.

```powershell
npm ci
# Sólo si todavía no existe el archivo de configuración local:
Copy-Item src/provisionCorporativa.example.ts src/provisionCorporativa.ts
```

Configurar el código de aprovisionamiento autorizado en `src/provisionCorporativa.ts`. El archivo real está excluido de Git. `src/nubeConfig.ts` contiene la URL y la clave pública del servicio; los permisos se comprueban en el servidor.

```powershell
npm run typecheck
npm test
powershell -ExecutionPolicy Bypass -File .\compilar.ps1
```

Expo genera el proyecto Android. `expo prebuild --no-clean` conserva sus archivos locales. Para actualizar teléfonos ya instalados, conservar el almacén de firma original; los almacenes de claves no se versionan. `verificar-apk.ps1` valida identificador, versión, firma y alineación de 16 KB. Los binarios, dependencias y cachés se generan localmente.

## Panel web

```powershell
cd admin
npm ci
npm run build
npm run dev
```

Vite permite revisar la interfaz. Para ejecutar también `/api/admin`, usar `vercel dev` con las variables privadas configuradas. Ver [admin/README.md](admin/README.md).

El administrador puede consultar, editar y eliminar novedades de cualquier día, descargar reportes generales, administrar cuentas y consultar informes de seguridad de 16 puntos. Los permisos se verifican en la base; las correcciones tienen auditoría cifrada. Eliminar una cuenta bloquea su acceso y conserva las firmas históricas.

## Base de datos y configuración privada

Para una instalación nueva, revisar y ejecutar `nube/002_servicio.sql`, después `nube/003_alta_sin_administrador.sql` y las migraciones de `supabase/migrations/` en orden cronológico. El aprovisionamiento inicial del objetivo y la primera cuenta administradora requieren al propietario. No usar los fixtures como datos iniciales.

No se incluyen claves de Vault, PIN, tokens, almacenes de firma ni credenciales de GitHub/Vercel. Los archivos de pruebas SQL contienen cuentas ficticias y usan `ROLLBACK`. El servicio cifra los registros recuperables; no es cifrado de extremo a extremo frente al propietario de PostgreSQL/Vault. Consultar los límites en [nube/README.md](nube/README.md).

La versión móvil se valida con TypeScript, 60 pruebas automatizadas y compilación Android. Las pruebas del servicio cubren dos teléfonos, firma y autor de carga, permisos administrativos, edición histórica, cuentas y revocación de sesiones. Falta la comprobación final de instalación en los teléfonos físicos.

Vercel está conectado a este repositorio privado y compila el panel desde `admin` al recibir cambios en `develop`. La publicación automática sobre la dirección principal está desactivada: revisar el build y promoverlo explícitamente. Ver el flujo en [admin/README.md](admin/README.md). Las variables privadas se conservan en Vercel.
