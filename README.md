# VIGELIUM · Desarrollo

Aplicación Android y panel administrativo para el servicio de vigilancia. Desarrollada por Franco Daniel Bevacua. Repositorio privado, rama `develop`. Versión móvil **1.5.0**, código **9**, identificador `ar.com.securia.app`.

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

El despliegue de Vercel fue realizado por el propietario. Este repositorio contiene el código de desarrollo y no modifica sus variables o configuración de despliegue.
