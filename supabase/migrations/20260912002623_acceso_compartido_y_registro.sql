-- Conectar ambos teléfonos al mismo objetivo; validar registros sin expresiones escapadas.
create or replace function public.guardia_rpc(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 accion text:=p_request->>'accion'; dh text:=guardia_private.hash(coalesce(p_request->>'dispositivo',''));
 d guardia_private.dispositivos; doc guardia_private.documentos; cred guardia_private.credenciales;
 inv guardia_private.invitaciones; ses guardia_private.sesiones;
 estado jsonb; candidato jsonb; perfil jsonb; v jsonb; actor text; dni text; sal text; verificador text;
 token text; revision bigint; intento integer; es_ok boolean:=false; nuevo_id text; sal_nueva text; verificador_nuevo text;
begin
 if octet_length(p_request::text)>35000000 then raise exception 'Solicitud demasiado grande'; end if;
 if coalesce(p_request->>'dispositivo','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','Teléfono no vinculado'); end if;
 select * into d from guardia_private.dispositivos where hash=dh for update;

 if accion='conectar' then
   if d.hash is null then
     select * into inv from guardia_private.invitaciones where hash=guardia_private.hash(trim(p_request->>'codigo')) for update;
     if not found or inv.vence<now() or inv.dispositivo is null then return jsonb_build_object('ok',false,'error','La activación corporativa no está disponible. Contacte al administrador.'); end if;
     select t.objetivo into nuevo_id from guardia_private.dispositivos t where t.hash=inv.dispositivo and not t.revocado;
     if nuevo_id is null then return jsonb_build_object('ok',false,'error','La activación corporativa no está disponible.'); end if;
     insert into guardia_private.dispositivos(hash,objetivo) values(dh,nuevo_id::uuid) on conflict(hash) do nothing;
     select * into d from guardia_private.dispositivos where hash=dh for update;
     if d.objetivo<>nuevo_id::uuid then return jsonb_build_object('ok',false,'error','El teléfono pertenece a otro objetivo.'); end if;
   end if;
   if d.revocado then return jsonb_build_object('ok',false,'error','Este teléfono está revocado. Contacte al administrador.'); end if;
   -- La conexión sólo vincula el teléfono. El historial exige autenticar DNI y PIN.
   return jsonb_build_object('ok',true,'vinculado',true);
 end if;

 if accion='vincular' then
   select * into inv from guardia_private.invitaciones where hash=guardia_private.hash(trim(p_request->>'codigo')) for update;
   if not found or inv.vence<now() or (inv.dispositivo is not null and inv.dispositivo<>dh) then return jsonb_build_object('ok',false,'error','Código inválido, usado o vencido'); end if;
   if inv.dispositivo is null then
     if d.hash is not null then return jsonb_build_object('ok',false,'error','Este teléfono ya está vinculado'); end if;
     estado:=p_request->'estado'; actor:=p_request->>'guardia';
     perform guardia_private.validar_formato(estado);
     select x into perfil from jsonb_array_elements(estado->'guards') x where x->>'id'=actor and (x->>'cuenta')::boolean and not coalesce((x->>'deleted')::boolean,false);
     if perfil is null or coalesce(perfil->>'dni','') !~ '^[0-9]{7,8}$' then raise exception 'Complete el DNI de su cuenta para la conexión inicial'; end if;
     estado:=jsonb_set(estado,'{guards}',(select jsonb_agg(x||jsonb_build_object('rol','vigilador')) from jsonb_array_elements(estado->'guards') x));
     insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(estado)) returning * into doc;
     insert into guardia_private.dispositivos(hash,objetivo) values(dh,doc.id) returning * into d;
     for perfil in select x from jsonb_array_elements(estado->'guards') x where coalesce((x->>'cuenta')::boolean,false) and not coalesce((x->>'deleted')::boolean,false) loop
       select x into v from jsonb_array_elements(p_request->'credenciales') x where x->>'id'=perfil->>'id';
       if coalesce(v->>'sal','') !~ '^[a-f0-9]{32}$' or coalesce(v->>'hash','') !~ '^[a-f0-9]{64}$' then raise exception 'Una cuenta anterior no tiene PIN migrable'; end if;
       dni:=nullif(perfil->>'dni','');
       if dni is not null and dni !~ '^[0-9]{7,8}$' then raise exception 'DNI inválido en una cuenta'; end if;
       insert into guardia_private.credenciales values(doc.id,perfil->>'id',case when dni is null then null else guardia_private.identidad(dni) end,v->>'sal',
         extensions.crypt(guardia_private.identidad(v->>'hash'),extensions.gen_salt('bf',12)));
     end loop;
     update guardia_private.invitaciones set dispositivo=dh where hash=inv.hash;
   else
     select * into doc from guardia_private.documentos where id=d.objetivo;
     estado:=guardia_private.abrir(doc.cifrado);
     -- La reanudación exige probar el PIN; no entrega una sesión sólo por repetir el código.
     return jsonb_build_object('ok',true,'vinculado',true);
   end if;
 elsif d.hash is null or d.revocado then
   return jsonb_build_object('ok',false,'error','Teléfono no vinculado o revocado');
 else
   select * into doc from guardia_private.documentos where id=d.objetivo for update;
   estado:=guardia_private.abrir(doc.cifrado);
 end if;

 if accion='catalogo' then
   return jsonb_build_object('ok',true,'catalogo',jsonb_build_object('site',estado->'site','posts',estado->'posts','franjas',estado->'franjas'));
 end if;
 if accion in ('ingresar','registrar','vincular_cuenta') then
   if d.bloqueado_hasta>now() then return jsonb_build_object('ok',false,'error','Demasiados intentos. Esperá un minuto.'); end if;
   dni:=regexp_replace(coalesce(p_request->>'dni',''),'[.[:space:]]','','g');
   if dni !~ '^[0-9]{7,8}$' or dni ~ '^0+$' or coalesce(p_request->>'pin','') !~ '^[0-9]{4,6}$' then return jsonb_build_object('ok',false,'error','DNI o PIN inválidos'); end if;
   if accion='registrar' then
     if exists(select 1 from guardia_private.credenciales where objetivo=doc.id and dni_hmac=guardia_private.identidad(dni)) then return jsonb_build_object('ok',false,'codigo','cuenta_existe','error','Ese DNI ya tiene una cuenta. Inicie sesión con su PIN.'); end if;
     perfil:=p_request->'perfil';
     if coalesce(perfil->>'apellido','')='' or coalesce(perfil->>'nombre','')='' or coalesce(perfil->>'foto','')='' then raise exception 'Completá nombre, apellido y foto'; end if;
     if coalesce(perfil->>'fechaNac','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (perfil->>'fechaNac')::date>=current_date then raise exception 'Fecha de nacimiento inválida'; end if;
     if not exists(select 1 from jsonb_array_elements(estado->'posts') x where x->>'id'=perfil->>'puestoId' and not coalesce((x->>'deleted')::boolean,false))
       or not exists(select 1 from jsonb_array_elements(estado->'franjas') x where x->>'id'=perfil->>'franjaId' and x->>'puestoId'=perfil->>'puestoId' and not coalesce((x->>'deleted')::boolean,false)) then raise exception 'Puesto o turno no disponible'; end if;
     select x into candidato from jsonb_array_elements(estado->'guards') x where guardia_private.nombre(x)=guardia_private.nombre(perfil) and not coalesce((x->>'deleted')::boolean,false) limit 1;
     if coalesce((candidato->>'cuenta')::boolean,false) then return jsonb_build_object('ok',false,'error','Usá Vincular DNI a mi cuenta anterior'); end if;
     actor:=coalesce(candidato->>'id',gen_random_uuid()::text);
     perfil:=(perfil-'pin')||jsonb_build_object('id',actor,'dni',dni,'cuenta',true,'rol','vigilador','updatedAt',floor(extract(epoch from clock_timestamp())*1000));
     estado:=jsonb_set(estado,'{guards}',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(estado->'guards') x where x->>'id'<>actor)||jsonb_build_array(perfil));
     sal:=encode(extensions.gen_random_bytes(16),'hex');
     verificador:=guardia_private.identidad(guardia_private.hash(sal||':'||(p_request->>'pin')));
     insert into guardia_private.credenciales values(doc.id,actor,guardia_private.identidad(dni),sal,extensions.crypt(verificador,extensions.gen_salt('bf',12)));
     update guardia_private.documentos set cifrado=guardia_private.cifrar(estado),revision=doc.revision+1,actualizado=now() where id=doc.id returning * into doc;
     es_ok:=true;
   else
     if accion='ingresar' then
       select * into cred from guardia_private.credenciales where objetivo=doc.id and dni_hmac=guardia_private.identidad(dni);
     else
       select x into perfil from jsonb_array_elements(estado->'guards') x where guardia_private.nombre(x)=upper(regexp_replace(trim(p_request->>'nombre'),'[[:space:]]+',' ','g')) and x->>'fechaNac'=p_request->>'nacimiento' and coalesce(x->>'dni','')='' and not coalesce((x->>'deleted')::boolean,false) limit 1;
       select * into cred from guardia_private.credenciales where objetivo=doc.id and guardia=perfil->>'id';
     end if;
     if cred.guardia is not null then
       verificador:=guardia_private.identidad(guardia_private.hash(cred.sal||':'||(p_request->>'pin')));
       es_ok:=extensions.crypt(verificador,cred.verificador)=cred.verificador;
       select x into perfil from jsonb_array_elements(estado->'guards') x where x->>'id'=cred.guardia and not coalesce((x->>'deleted')::boolean,false);
       es_ok:=es_ok and perfil is not null;
     else
       -- Igual costo criptográfico para una identidad inexistente.
       perform extensions.crypt(guardia_private.identidad('inexistente'),extensions.gen_salt('bf',12));
     end if;
     actor:=cred.guardia;
     if es_ok and accion='vincular_cuenta' then
       if exists(select 1 from guardia_private.credenciales where objetivo=doc.id and dni_hmac=guardia_private.identidad(dni)) then return jsonb_build_object('ok',false,'error','Ese DNI ya tiene cuenta'); end if;
       update guardia_private.credenciales set dni_hmac=guardia_private.identidad(dni) where objetivo=doc.id and guardia=actor;
       estado:=jsonb_set(estado,'{guards}',(select jsonb_agg(case when x->>'id'=actor then x||jsonb_build_object('dni',dni) else x end) from jsonb_array_elements(estado->'guards') x));
       update guardia_private.documentos set cifrado=guardia_private.cifrar(estado),revision=doc.revision+1,actualizado=now() where id=doc.id returning * into doc;
     end if;
   end if;
   if not es_ok then
     intento:=d.intentos+1;
     update guardia_private.dispositivos set intentos=case when intento>=5 then 0 else intento end,bloqueado_hasta=case when intento>=5 then now()+interval '1 minute' else null end where hash=dh;
     return jsonb_build_object('ok',false,'error','DNI o PIN incorrectos');
   end if;
   update guardia_private.dispositivos set intentos=0,bloqueado_hasta=null where hash=dh;
 end if;
 if accion in ('vincular','ingresar','registrar','vincular_cuenta') then
   delete from guardia_private.sesiones where dispositivo=dh;
   token:=encode(extensions.gen_random_bytes(32),'hex');
   insert into guardia_private.sesiones(hash,dispositivo,guardia) values(guardia_private.hash(token),dh,actor);
   return jsonb_build_object('ok',true,'token',token,'guardia',actor,'estado',estado,'revision',doc.revision);
 end if;
 select * into ses from guardia_private.sesiones where hash=guardia_private.hash(coalesce(p_request->>'token','')) and dispositivo=dh and vence>now();
 if ses.hash is null then return jsonb_build_object('ok',false,'codigo','sesion','error','Iniciá sesión con tu DNI y PIN'); end if;
 actor:=ses.guardia;
 if not exists(select 1 from jsonb_array_elements(estado->'guards') x where x->>'id'=actor and not coalesce((x->>'deleted')::boolean,false)) then return jsonb_build_object('ok',false,'error','Cuenta no disponible'); end if;
 if accion='consultar' then return jsonb_build_object('ok',true,'estado',estado,'guardia',actor,'revision',doc.revision); end if;
 if accion='cambiar_pin' then
   if d.bloqueado_hasta>now() then return jsonb_build_object('ok',false,'error','Demasiados intentos. Esperá un minuto.'); end if;
   if coalesce(p_request->>'nuevo','') !~ '^[0-9]{4,6}$' then return jsonb_build_object('ok',false,'error','El PIN debe tener de 4 a 6 dígitos'); end if;
   select * into cred from guardia_private.credenciales where objetivo=doc.id and guardia=actor;
   verificador:=guardia_private.identidad(guardia_private.hash(cred.sal||':'||coalesce(p_request->>'actual','')));
   if extensions.crypt(verificador,cred.verificador)<>cred.verificador then
     intento:=d.intentos+1;
     update guardia_private.dispositivos set intentos=case when intento>=5 then 0 else intento end,bloqueado_hasta=case when intento>=5 then now()+interval '1 minute' else null end where hash=dh;
     return jsonb_build_object('ok',false,'error','El PIN actual no coincide');
   end if;
   sal_nueva:=encode(extensions.gen_random_bytes(16),'hex');
   verificador_nuevo:=guardia_private.identidad(guardia_private.hash(sal_nueva||':'||(p_request->>'nuevo')));
   update guardia_private.credenciales c set sal=sal_nueva,verificador=extensions.crypt(verificador_nuevo,extensions.gen_salt('bf',12)) where c.objetivo=doc.id and c.guardia=actor;
   update guardia_private.dispositivos set intentos=0,bloqueado_hasta=null where hash=dh;
   return jsonb_build_object('ok',true);
 end if;
 if accion='guardar' then
   candidato:=p_request->'estado'; revision:=(p_request->>'revision')::bigint;
   -- Reintento idempotente después de una respuesta perdida.
   if candidato=estado then return jsonb_build_object('ok',true,'revision',doc.revision); end if;
   if revision is distinct from doc.revision then return jsonb_build_object('ok',false,'codigo','conflicto','error','La nube tiene cambios más recientes. No se sobrescribieron.'); end if;
   perform guardia_private.validar_cambios(estado,candidato,actor);
   update guardia_private.documentos set cifrado=guardia_private.cifrar(candidato),revision=doc.revision+1,actualizado=now() where id=doc.id returning documentos.revision into revision;
   return jsonb_build_object('ok',true,'revision',revision);
 end if;
 if accion='salir' then
   if exists(select 1 from jsonb_array_elements(estado->'punches') x where x->>'guardId'=actor and coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')='') then return jsonb_build_object('ok',false,'error','Cerrá tu turno antes de salir'); end if;
   delete from guardia_private.sesiones where hash=ses.hash;
   return jsonb_build_object('ok',true);
 end if;
 return jsonb_build_object('ok',false,'error','Operación no disponible');
end;
$$;

revoke all on function public.guardia_rpc(jsonb) from public;
grant execute on function public.guardia_rpc(jsonb) to anon,authenticated;
create or replace function guardia_private.nombre(g jsonb) returns text language sql immutable set search_path='' as $$
select upper(regexp_replace(trim(coalesce(g->>'apellido','')||' '||coalesce(g->>'nombre','')), '[[:space:]]+', ' ', 'g'));
$$;
revoke all on function guardia_private.nombre(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
