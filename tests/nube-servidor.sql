-- Ejecutar con fixtures generados. Todo se revierte, incluidas cuentas y sesiones de prueba.
begin;
do $test$
declare fx jsonb := $fixtures$__FIXTURES__$fixtures$::jsonb;
 e jsonb; r jsonb; t text; codigo text; rev bigint; i integer; rechazado boolean; cifrado bytea; objetivo uuid;
 dispositivo text:=encode(extensions.gen_random_bytes(32),'hex');
 segundo text:=encode(extensions.gen_random_bytes(32),'hex');
begin
 if has_table_privilege('anon','guardia_private.documentos','select') or has_schema_privilege('anon','guardia_private','usage') then raise exception 'FALLO: datos públicos'; end if;
 if not has_function_privilege('anon','public.guardia_rpc(jsonb)','execute') then raise exception 'FALLO: RPC inaccesible'; end if;
 if has_function_privilege('anon','guardia_private.emitir_codigo()','execute') then raise exception 'FALLO: invitación pública'; end if;
 if has_function_privilege('anon','guardia_private.asignar_administrador(uuid,text)','execute') then raise exception 'FALLO: asignación pública de administrador'; end if;
 cifrado:=guardia_private.cifrar('{"texto":"información reservada"}'::jsonb);
 if guardia_private.abrir(cifrado)->>'texto'<>'información reservada' then raise exception 'FALLO: cifrado'; end if;
 rechazado:=false;
 begin perform extensions.pgp_sym_decrypt(cifrado,'clave incorrecta'); exception when others then rechazado:=true; end;
 if not rechazado then raise exception 'FALLO: se pudo descifrar con otra clave'; end if;
 codigo:=guardia_private.emitir_codigo();
 r:=public.guardia_rpc(jsonb_build_object('accion','vincular','dispositivo',dispositivo,'codigo',codigo,'estado',jsonb_set(fx->'estados'->0,'{guards,0,rol}','"vigilador"'::jsonb),'guardia','nube-test-a','credenciales',fx->'cred'));
 if not (r->>'ok')::boolean or r->>'token' is null then raise exception 'FALLO: vinculación %',r; end if;
 t:=r->>'token'; rev:=(r->>'revision')::bigint;
 if exists(select 1 from jsonb_array_elements(r->'estado'->'guards') x where x->>'rol'='admin') then raise exception 'FALLO: administrador automático'; end if;
 rechazado:=false;
 begin
  perform public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',t,'revision',rev,'estado',fx->'estados'->0));
 exception when others then rechazado:=true; end;
 if not rechazado then raise exception 'FALLO: el cliente se convirtió en administrador'; end if;
 select d.objetivo into objetivo from guardia_private.dispositivos d where hash=guardia_private.hash(dispositivo);
 perform guardia_private.asignar_administrador(objetivo,'nube-test-a');
 r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',dispositivo,'dni','12345678','pin','654321'));
 if not (r->>'ok')::boolean or r->'estado'->'guards'->0->>'rol'<>'admin' then raise exception 'FALLO: asignación desde la base de datos'; end if;
 t:=r->>'token';rev:=(r->>'revision')::bigint;
 for i in 1..5 loop
  r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',dispositivo,'dni','12345678','pin','000000'));
  if (r->>'ok')::boolean then raise exception 'FALLO: PIN incorrecto'; end if;
 end loop;
 r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',dispositivo,'dni','12345678','pin','654321'));
 if r->>'error' not like 'Demasiados%' then raise exception 'FALLO: bloqueo de intentos'; end if;
 update guardia_private.dispositivos set bloqueado_hasta=now()-interval '1 second' where hash=guardia_private.hash(dispositivo);
 r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',dispositivo,'dni','12345678','pin','654321'));
 if not (r->>'ok')::boolean then raise exception 'FALLO: ingreso %',r; end if;
 t:=r->>'token';
 for i in 1..3 loop
   e:=fx->'estados'->i;
   r:=public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',t,'revision',rev,'estado',e));
   if not (r->>'ok')::boolean then raise exception 'FALLO: escritura % %',i,r; end if;
   rev:=(r->>'revision')::bigint;
 end loop;
 -- Reintento de respuesta perdida no crea una versión adicional.
 r:=public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',t,'revision',rev-1,'estado',e));
 if not (r->>'ok')::boolean or (r->>'revision')::bigint<>rev then raise exception 'FALLO: idempotencia'; end if;
 rechazado:=false;
 begin
   perform public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',t,'revision',rev,'estado',jsonb_set(e,'{novedades,1,texto}','"Alteración"'::jsonb)));
 exception when others then rechazado:=true;end;
 if not rechazado then raise exception 'FALLO: se alteró un turno cerrado'; end if;
 -- Un conflicto no sobrescribe el estado guardado.
 r:=public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',t,'revision',rev-1,'estado',jsonb_set(e,'{site,cliente}','"Cambio"'::jsonb)));
 if r->>'codigo'<>'conflicto' then raise exception 'FALLO: control de versiones'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','vincular_cuenta','dispositivo',dispositivo,'dni','23456789','pin','654321','nombre','Prueba Bruno','nacimiento','1990-01-01'));
 if not (r->>'ok')::boolean or r->>'guardia'<>'nube-test-b' then raise exception 'FALLO: cuenta anterior %',r; end if;
 t:=r->>'token';rev:=(r->>'revision')::bigint;e:=r->'estado';
 rechazado:=false;
 begin perform public.guardia_rpc(jsonb_build_object('accion','guardar','dispositivo',dispositivo,'token',t,'revision',rev,'estado',jsonb_set(e,'{novedades,1,texto}','"Otro autor"'::jsonb)));
 exception when others then rechazado:=true;end;
 if not rechazado then raise exception 'FALLO: cambio de otro autor'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','consultar','dispositivo',dispositivo,'token',t));
 if not (r->>'ok')::boolean or jsonb_array_length(r->'estado'->'novedades')<>3 then raise exception 'FALLO: lectura compartida'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','consultar','dispositivo',repeat('f',64),'token',t));
 if (r->>'ok')::boolean then raise exception 'FALLO: aislamiento de dispositivo'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','cambiar_pin','dispositivo',dispositivo,'token',t,'actual','000000','nuevo','456789'));
 if (r->>'ok')::boolean then raise exception 'FALLO: cambio sin PIN actual'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','cambiar_pin','dispositivo',dispositivo,'token',t,'actual','654321','nuevo','456789'));
 if not (r->>'ok')::boolean then raise exception 'FALLO: cambio de PIN %',r; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',dispositivo,'dni','23456789','pin','654321'));
 if (r->>'ok')::boolean then raise exception 'FALLO: PIN anterior vigente'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',dispositivo,'dni','23456789','pin','456789'));
 if not (r->>'ok')::boolean then raise exception 'FALLO: PIN nuevo %',r; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','registrar','dispositivo',dispositivo,'dni','34567890','pin','987654','perfil',
   (fx->'estados'->0->'guards'->0)||jsonb_build_object('apellido','Ensayo','nombre','Carla','foto','data:image/png;base64,AA==','rol','admin')));
 if not (r->>'ok')::boolean then raise exception 'FALLO: registro %',r; end if;
 if not exists(select 1 from jsonb_array_elements(r->'estado'->'guards') x where x->>'id'=r->>'guardia' and x->>'rol'='vigilador') then raise exception 'FALLO: escalada de rol al registrarse'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',dispositivo,'dni','34567890','pin','987654'));
 if not (r->>'ok')::boolean then raise exception 'FALLO: ingreso de nueva cuenta %',r; end if;
 -- Otro teléfono se vincula al mismo objetivo, sin recibir cuentas ni historial.
 r:=public.guardia_rpc(jsonb_build_object('accion','conectar','dispositivo',segundo,'codigo','incorrecto'));
 if (r->>'ok')::boolean then raise exception 'FALLO: código inválido'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','conectar','dispositivo',segundo,'codigo',codigo));
 if not (r->>'ok')::boolean or r ? 'estado' or r ? 'token' then raise exception 'FALLO: conexión del corporativo %',r; end if;
 if (select d.objetivo from guardia_private.dispositivos d where d.hash=guardia_private.hash(segundo))<>objetivo then raise exception 'FALLO: objetivo diferente'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','consultar','dispositivo',segundo));
 if (r->>'ok')::boolean then raise exception 'FALLO: historial sin autenticar'; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',segundo,'dni','12345678','pin','654321'));
 if not (r->>'ok')::boolean or r->>'guardia'<>'nube-test-a' then raise exception 'FALLO: administrador desde corporativo %',r; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','registrar','dispositivo',segundo,'dni','45678901','pin','987654','perfil',
 (fx->'estados'->0->'guards'->0)||jsonb_build_object('apellido','Ensayo','nombre','Daniel','nacimiento','1990-01-01','foto','data:image/png;base64,AA==')));
 if not (r->>'ok')::boolean then raise exception 'FALLO: registro corporativo %',r; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','registrar','dispositivo',segundo,'dni','45678901','pin','987654','perfil',fx->'estados'->0->'guards'->0));
 if r->>'codigo'<>'cuenta_existe' then raise exception 'FALLO: recuperación de registro repetido %',r; end if;
 r:=public.guardia_rpc(jsonb_build_object('accion','ingresar','dispositivo',dispositivo,'dni','45678901','pin','987654'));
 if not (r->>'ok')::boolean then raise exception 'FALLO: nueva cuenta compartida %',r; end if;
end;
$test$;
select 'OK: cifrado, permisos, DNI/PIN, bloqueo, migración, escritura, cierre, idempotencia, conflicto, aislamiento, cambio de PIN, registro y segundo teléfono' as verificacion;
rollback;
