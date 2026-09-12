# Servicio de nube VIGELIUM 1.4.2

Proyecto Guardia App de Supabase: dqdjkxychiwcnplhytzc.

## Actualización de los teléfonos

Instalar la APK 1.4.2 sobre la aplicación existente en ambos teléfonos. No desinstalar ni borrar datos: la clave de los cambios pendientes está en SecureStore. Esta versión no ejecuta el reinicio histórico de cuentas. Se conserva la cuenta de Franco Bevacua, su PIN y su rol de administrador.

Al iniciar, Android conecta el dispositivo al objetivo corporativo existente. La capacidad de aprovisionamiento está en `src/provisionCorporativa.ts`, excluido del repositorio. No es una clave privada de Supabase. La acción `conectar` admite otro teléfono del mismo objetivo; sólo devuelve la confirmación del vínculo. El historial exige DNI/PIN o un registro válido. El código actual vence el 10/09/2027 a las 23:59 UTC. Antes de esa fecha debe renovarse el aprovisionamiento para nuevas instalaciones; los dispositivos ya vinculados conservan su vínculo.

Las cuentas se comparten entre teléfonos vinculados. Un vigilador cuya alta anterior falló debe registrarse desde la nueva versión; no se inventan cuentas ni se reemplazan credenciales. Si el servidor creó la cuenta pero se perdió la respuesta, repetir el registro intenta ingresar con ese mismo DNI/PIN. Un PIN diferente no modifica la cuenta existente.

## Corrección del incidente

- Android exige bytes en `AESSealedData.fromCombined`. Ahora se decodifica explícitamente el Base64 almacenado antes de pasar al puente Kotlin. El formato previo y su clave se conservan.
- Los errores de descifrado o de acceso a la clave son breves y no muestran el contenido cifrado ni la traza nativa.
- Se corrigió la validación de fecha de nacimiento en el RPC. Usa expresiones sin escapes ambiguos.
- Se vincula el teléfono corporativo al objetivo existente antes de mostrar el acceso. Android no recurre a una cuenta local cuando falta la conexión.
- La cola combina altas independientes y cambios compatibles de dos teléfonos. Conserva el rol y la identidad del servidor. Si ambos modifican el mismo dato de manera incompatible, conserva la copia cifrada y muestra el conflicto.
- Las colas anteriores sin base de comparación sólo recuperan altas sin colisiones; no reemplazan registros existentes diferentes.

## Despliegue y seguridad

El instalador base es `002_servicio.sql`. `003_alta_sin_administrador.sql` incorpora el alta sin administrador y la asignación privada. La migración aplicada para 1.4.2 es `supabase/migrations/20260912002623_acceso_compartido_y_registro.sql`; no borra ni reinicia las tablas.

El registro fuerza el rol vigilador. Sólo el propietario de la base puede asignar administradores con `guardia_private.asignar_administrador(uuid,text)`. No hay elevación de rol desde el cliente. La cuenta real conserva el rol admin y la revisión 2 después de las pruebas.

Las tablas privadas tienen RLS y no conceden acceso directo a anon/authenticated. El único acceso público es `guardia_rpc(jsonb)`, que valida dispositivo, sesión, identidad, autoría y revisión. Los avisos del asesor sobre tablas sin políticas y el RPC SECURITY DEFINER corresponden a esta arquitectura deliberada; no se habilitan políticas públicas para eliminarlos.

Los perfiles, registros y evidencias se cifran mediante pgcrypto PGP con AES-256; las claves viven en Vault. El DNI se busca mediante HMAC y se conserva legible dentro del documento cifrado. El PIN se verifica con bcrypt costo 12 sobre un verificador con sal individual y HMAC del servidor. Cinco intentos fallidos bloquean el dispositivo durante un minuto. Las sesiones expiran a las 24 horas. Los tokens y capacidades de dispositivo se almacenan como hashes en el servidor.

Los identificadores, revisiones y vencimientos son metadatos operativos. El propietario con acceso administrativo a PostgreSQL/Vault puede descifrar los documentos; no es cifrado de extremo a extremo frente al propietario.

En Android, SecureStore protege la capacidad del dispositivo y la clave local. El estado confirmado permanece en memoria; los cambios pendientes usan AES-256-GCM en AsyncStorage. El cierre de sesión exige sincronización. La copia de seguridad automática de Android está desactivada.

## Verificación de 1.4.2

- 60 pruebas automáticas, incluidas AES-GCM real con adaptador estricto del contrato Kotlin, recuperación de cola después de un PIN incorrecto, registro repetido, combinación de dos teléfonos y escritura concurrente con respuesta perdida.
- TypeScript sin errores.
- Pruebas transaccionales en el servicio real: cifrado, permisos, DNI/PIN, bloqueo de intentos, registro, asignación privada de administrador, rechazo de elevación de rol, escritura, historial de turno cerrado, idempotencia, conflicto, cambio de PIN y segundo teléfono vinculado al mismo objetivo.
- Las pruebas SQL usan `tests/nube-servidor.sql`, fixtures ficticios y ROLLBACK. Se verificó después que permanecen un objetivo, una cuenta y un teléfono reales, con la misma revisión 2.
- No se ingresó con el PIN del usuario ni se probó esta APK en sus teléfonos físicos. Las pruebas de adaptadores y servicio no sustituyen esa comprobación final de instalación.

## Operación y límites

Los nuevos inicios requieren Internet. Durante una sesión abierta se pueden guardar cambios pendientes; deben sincronizarse antes del relevo. Nunca borrar datos ni desinstalar con cambios pendientes. El objetivo mantiene un turno de servicio abierto compartido; usar dos teléfonos no crea dos turnos independientes.

No emitir una invitación inicial nueva para recuperar este objetivo: `vincular` crea otro objetivo. Un dispositivo perdido requiere revocación por el propietario. No hay recuperación automática de PIN.

El cliente consulta el objetivo completo después de autenticar. El límite por documento es 32 MB de JSON con evidencias. El archivo histórico, los respaldos externos y la rotación de claves requieren administración; no hay purga automática. Los PDF, fotos y mensajes exportados contienen el material legible que el usuario decide compartir. La versión web se usa para pruebas y guarda claves en localStorage, sin la protección SecureStore de Android.
