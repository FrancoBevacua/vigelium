# VIGELIUM · Panel administrativo

Interfaz React/Vite y API Vercel, conectadas al mismo servicio Supabase que el móvil.

Instalar con `npm ci`. Configurar en Vercel las variables de `.env.example`: `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY`, `CORPORATE_CODE` y `SESSION_SECRET`. Esta última debe ser aleatoria y privada, con al menos 32 caracteres. Son variables del servidor: no usar el prefijo `VITE_`, que las expondría al navegador. No se necesita una clave `service_role`.

`npm run build` sincroniza los módulos compartidos y genera `dist/`. Las copias de `shared/` permiten compilar también cuando se despliega únicamente esta carpeta. Usar `admin/` como raíz del proyecto Vercel. `npm run dev` sirve la interfaz; `vercel dev` ejecuta además la API.

Se ingresa con DNI/PIN de una cuenta administradora. La base verifica el rol en cada operación. La sesión utiliza una cookie HttpOnly protegida, con vencimiento de ocho horas. Los intentos incorrectos se limitan también por identidad.

El panel permite corregir el historial, descargar PDF con la plantilla móvil, administrar cuentas y consultar informes de seguridad. Las listas omiten imágenes; las evidencias se solicitan al abrirlas o preparar el PDF. Las modificaciones requieren una revisión vigente y tienen auditoría cifrada. La cuenta administradora no puede eliminarse a sí misma ni dejar al objetivo sin administradores.

El despliegue vigente fue realizado por el propietario. Los archivos `.env`, `.vercel`, tokens y credenciales no se suben al repositorio.
