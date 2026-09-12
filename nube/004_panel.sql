create table if not exists guardia_private.intentos_admin(objetivo uuid not null references guardia_private.documentos(id),identidad text not null,intentos integer not null default 0,bloqueado timestamptz,primary key(objetivo,identidad));
alter table guardia_private.intentos_admin enable row level security;
revoke all on guardia_private.intentos_admin from public,anon,authenticated;
-- Acceso administrativo mediante la misma identidad DNI/PIN y sesiones del servicio.
create table if not exists guardia_private.auditoria (
 id uuid primary key default gen_random_uuid(), objetivo uuid not null references guardia_private.documentos(id),
 actor text not null, accion text not null, creado timestamptz not null default now(), cifrado bytea not null
);
alter table guardia_private.auditoria enable row level security;
revoke all on guardia_private.auditoria from public,anon,authenticated;
create index if not exists auditoria_objetivo_fecha on guardia_private.auditoria(objetivo,creado desc);

create or replace function guardia_private.sin_imagenes(j jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare r jsonb; k text; v jsonb;
begin
 if jsonb_typeof(j)='array' then select coalesce(jsonb_agg(guardia_private.sin_imagenes(x)),'[]'::jsonb) into r from jsonb_array_elements(j) x; return r; end if;
 if jsonb_typeof(j)<>'object' then return j; end if;
 r:='{}'::jsonb;
 for k,v in select * from jsonb_each(j) loop
  if k in ('foto','fotos','adjuntos') then
   if k='fotos' and jsonb_typeof(v)='array' then r:=r||jsonb_build_object('fotosTotal',jsonb_array_length(v)); end if;
  else r:=r||jsonb_build_object(k,guardia_private.sin_imagenes(v)); end if;
 end loop;
 return r;
end; $$;
revoke all on function guardia_private.sin_imagenes(jsonb) from public,anon,authenticated;

create or replace function public.guardia_admin_rpc(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d guardia_private.dispositivos; doc guardia_private.documentos; ses guardia_private.sesiones;
 e jsonb; g jsonb; acceso jsonb; identidad_login text; anterior jsonb; nuevo jsonb; cambio jsonb; salida jsonb; col text; registro text; accion text:=p_request->>'accion';
 dni text; sal text; verificador text; instante bigint:=floor(extract(epoch from clock_timestamp())*1000);
begin
 if octet_length(p_request::text)>3500000 then raise exception 'La solicitud supera el tamaño permitido'; end if;
 select * into d from guardia_private.dispositivos where hash=guardia_private.hash(coalesce(p_request->>'dispositivo','')) and not revocado for update;
 if d.hash is null then return jsonb_build_object('ok',false,'codigo','sesion','error','Dispositivo no vinculado.');end if;
 if accion='ingresar' then
  if coalesce(p_request->>'dni','')!~'^[0-9]{7,8}$' or coalesce(p_request->>'pin','')!~'^[0-9]{4,6}$' then return jsonb_build_object('ok',false,'error','DNI o PIN inválidos.');end if;
  identidad_login:=guardia_private.identidad(p_request->>'dni');
  insert into guardia_private.intentos_admin(objetivo,identidad) values(d.objetivo,identidad_login) on conflict do nothing;
  perform 1 from guardia_private.intentos_admin where objetivo=d.objetivo and identidad=identidad_login for update;
  if exists(select 1 from guardia_private.intentos_admin where objetivo=d.objetivo and identidad=identidad_login and bloqueado>now()) then return jsonb_build_object('ok',false,'error','Demasiados intentos. Espere un minuto.');end if;
  acceso:=public.guardia_rpc(p_request||jsonb_build_object('accion','ingresar'));
  if coalesce((acceso->>'ok')::boolean,false) and exists(select 1 from jsonb_array_elements(acceso->'estado'->'guards') x where x->>'id'=acceso->>'guardia' and x->>'rol'='admin' and not coalesce((x->>'deleted')::boolean,false)) then
   update guardia_private.intentos_admin set intentos=0,bloqueado=null where objetivo=d.objetivo and identidad=identidad_login;
   update guardia_private.sesiones set vence=now()+interval '8 hours' where hash=guardia_private.hash(acceso->>'token');
   return jsonb_build_object('ok',true,'token',acceso->>'token');
  end if;
  if acceso ? 'token' then delete from guardia_private.sesiones where hash=guardia_private.hash(acceso->>'token');end if;
  update guardia_private.intentos_admin set intentos=case when intentos>=4 then 0 else intentos+1 end,bloqueado=case when intentos>=4 then now()+interval '1 minute' else null end where objetivo=d.objetivo and identidad=identidad_login;
  return jsonb_build_object('ok',false,'error','DNI o PIN incorrectos, o cuenta sin acceso administrativo.');
 end if;

 select * into ses from guardia_private.sesiones where hash=guardia_private.hash(coalesce(p_request->>'token','')) and dispositivo=d.hash and vence>now();
 if ses.hash is null then return jsonb_build_object('ok',false,'codigo','sesion','error','Inicie sesión para acceder al panel.'); end if;
 select * into doc from guardia_private.documentos where id=d.objetivo for update;
 e:=guardia_private.abrir(doc.cifrado);
 select x into g from jsonb_array_elements(e->'guards') x where x->>'id'=ses.guardia and x->>'rol'='admin' and coalesce((x->>'cuenta')::boolean,false) and not coalesce((x->>'deleted')::boolean,false);
 if g is null then return jsonb_build_object('ok',false,'codigo','prohibido','error','El panel es exclusivo para administradores.'); end if;
 if accion='salir' then delete from guardia_private.sesiones where hash=ses.hash;return jsonb_build_object('ok',true);end if;
 if accion='consultar' then return jsonb_build_object('ok',true,'estado',guardia_private.sin_imagenes(e),'guardia',ses.guardia,'revision',doc.revision); end if;
 col:=p_request->>'col';registro:=p_request->>'id';
 if accion='foto' then
  if col not in ('novedades','reports','infdias','guards') then raise exception 'Colección no disponible'; end if;
  select x into anterior from jsonb_array_elements(e->col) x where x->>'id'=registro and not coalesce((x->>'deleted')::boolean,false);
  if anterior is null then raise exception 'Registro no disponible'; end if;
  return jsonb_build_object('ok',true,'foto',case when col='guards' then anterior->'foto' else anterior->'fotos'->coalesce((p_request->>'indice')::integer,0) end);
 end if;
 if (p_request->>'revision')::bigint is distinct from doc.revision then return jsonb_build_object('ok',false,'codigo','conflicto','error','Hay cambios recientes. Actualice la vista antes de guardar.'); end if;
 cambio:=coalesce(p_request->'datos','{}'::jsonb);
 if accion in ('editar_asiento','eliminar_asiento') then
  if col not in ('novedades','alogs','visits') then raise exception 'Colección no disponible'; end if;
  select x into anterior from jsonb_array_elements(e->col) x where x->>'id'=registro and not coalesce((x->>'deleted')::boolean,false);
  if anterior is null then raise exception 'El asiento ya no está disponible'; end if;
  nuevo:=anterior;
  if col<>'novedades' then
   nuevo:=jsonb_build_object('id','admin:'||col||':'||registro,'fecha',anterior->>'fecha','hora',coalesce(anterior->>'hora',anterior->>'horaIn'),'guardId',anterior->>'guardId','createdBy',coalesce(anterior->>'createdBy',anterior->>'guardId'),'turnoId',anterior->>'turnoId','lockedAt',coalesce(anterior->'lockedAt',to_jsonb(instante)), 'texto','', 'categoria',case when col='alogs' then upper(anterior->>'tipo') else 'Externo' end);
   if col='alogs' then nuevo:=nuevo||jsonb_build_object('autoKey','acceso:'||registro,'alogId',registro);else nuevo:=nuevo||jsonb_build_object('visitId',registro,'mov','in');end if;
  end if;
  if accion='editar_asiento' then
   if exists(select 1 from jsonb_object_keys(cambio) k where k not in ('fecha','hora','categoria','texto','guardId')) then raise exception 'Campo no editable'; end if;
   nuevo:=nuevo||cambio;
   if coalesce(nuevo->>'fecha','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(nuevo->>'hora','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or length(trim(coalesce(nuevo->>'texto','')))=0 then raise exception 'Complete fecha, hora y descripción';end if;
   perform (nuevo->>'fecha')::date;
   if not exists(select 1 from jsonb_array_elements(e->'guards') x where x->>'id'=nuevo->>'guardId' and not coalesce((x->>'deleted')::boolean,false)) then raise exception 'Seleccione el vigilador que realizó la novedad';end if;
  else nuevo:=nuevo||jsonb_build_object('deleted',true);end if;
  nuevo:=nuevo||jsonb_build_object('updatedAt',instante,'adminUpdatedBy',ses.guardia);
  e:=jsonb_set(e,'{novedades}',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(e->'novedades') x where x->>'id'<>nuevo->>'id')||jsonb_build_array(nuevo));
 elsif accion in ('crear_cuenta','editar_cuenta','eliminar_cuenta') then
  col:='guards';
  if accion<>'crear_cuenta' then
   select x into anterior from jsonb_array_elements(e->'guards') x where x->>'id'=registro and not coalesce((x->>'deleted')::boolean,false);
   if anterior is null then raise exception 'Cuenta no disponible';end if;
  end if;
  if exists(select 1 from jsonb_object_keys(cambio) k where k not in ('apellido','nombre','dni','fechaNac','sexo','puestoId','franjaId','foto','tel','email','rol')) then raise exception 'Campo de cuenta no editable';end if;
  if accion='eliminar_cuenta' then
   if registro=ses.guardia then raise exception 'No puede eliminar su propia cuenta';end if;
   if exists(select 1 from jsonb_array_elements(e->'punches') x where x->>'guardId'=registro and coalesce(x->>'out','')='' and coalesce(x->>'closedAt','')='' and not coalesce((x->>'deleted')::boolean,false)) then raise exception 'El vigilador debe cerrar su turno antes de eliminar la cuenta';end if;
   nuevo:=anterior||jsonb_build_object('deleted',true,'cuenta',false,'updatedAt',instante);
   delete from guardia_private.credenciales where objetivo=doc.id and guardia=registro;
  else
   registro:=coalesce(anterior->>'id',gen_random_uuid()::text);
   nuevo:=coalesce(anterior,'{}'::jsonb)||cambio||jsonb_build_object('id',registro,'cuenta',true,'updatedAt',instante);
   dni:=coalesce(nuevo->>'dni','');
   if dni!~'^[0-9]{7,8}$' or dni~'^0+$' or length(trim(coalesce(nuevo->>'apellido','')))=0 or length(trim(coalesce(nuevo->>'nombre','')))=0 then raise exception 'Complete apellido, nombre y DNI válido';end if;
   if nuevo->>'sexo' not in ('masculino','femenino') or nuevo->>'sexo' is null then raise exception 'Seleccione el sexo';end if;
   if coalesce(nuevo->>'fechaNac','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (nuevo->>'fechaNac')::date>=current_date or (nuevo->>'fechaNac')::date<'1900-01-01' then raise exception 'Fecha de nacimiento inválida';end if;
   if coalesce(nuevo->>'rol','') not in ('vigilador','admin') then raise exception 'Rol inválido';end if;
   if registro=ses.guardia and nuevo->>'rol'<>'admin' then raise exception 'No puede quitarse su propio rol de administrador';end if;
   if not exists(select 1 from jsonb_array_elements(e->'posts') x where x->>'id'=nuevo->>'puestoId' and not coalesce((x->>'deleted')::boolean,false)) or not exists(select 1 from jsonb_array_elements(e->'franjas') x where x->>'id'=nuevo->>'franjaId' and x->>'puestoId'=nuevo->>'puestoId' and not coalesce((x->>'deleted')::boolean,false)) then raise exception 'Seleccione un puesto y turno válidos';end if;
   if exists(select 1 from guardia_private.credenciales c where c.objetivo=doc.id and c.dni_hmac=guardia_private.identidad(dni) and c.guardia<>registro) then raise exception 'El DNI ya pertenece a otra cuenta';end if;
   if accion='crear_cuenta' then
    if coalesce(p_request->>'pin','')!~'^[0-9]{4,6}$' then raise exception 'Indique un PIN de 4 a 6 dígitos';end if;
    if coalesce(nuevo->>'foto','')!~'^data:image/(jpeg|png|webp);base64,' then raise exception 'Agregue una foto para la credencial';end if;
    sal:=encode(extensions.gen_random_bytes(16),'hex');verificador:=guardia_private.identidad(guardia_private.hash(sal||':'||(p_request->>'pin')));
    insert into guardia_private.credenciales values(doc.id,registro,guardia_private.identidad(dni),sal,extensions.crypt(verificador,extensions.gen_salt('bf',12)));
   else update guardia_private.credenciales set dni_hmac=guardia_private.identidad(dni) where objetivo=doc.id and guardia=registro;end if;
  end if;
  if anterior->>'rol'='admin' and (coalesce((nuevo->>'deleted')::boolean,false) or nuevo->>'rol'<>'admin') and not exists(select 1 from jsonb_array_elements(e->'guards') x where x->>'id'<>registro and x->>'rol'='admin' and not coalesce((x->>'deleted')::boolean,false)) then raise exception 'Debe conservarse al menos un administrador';end if;
  if accion='eliminar_cuenta' or anterior->>'rol' is distinct from nuevo->>'rol' or anterior->>'dni' is distinct from nuevo->>'dni' then
   delete from guardia_private.sesiones s using guardia_private.dispositivos t where s.dispositivo=t.hash and t.objetivo=doc.id and s.guardia=registro;
  end if;
  e:=jsonb_set(e,'{guards}',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(e->'guards') x where x->>'id'<>registro)||jsonb_build_array(nuevo));
 else raise exception 'Operación no disponible';end if;
 e:=e||jsonb_build_object('updatedAt',instante);
 perform guardia_private.validar_formato(e);
 insert into guardia_private.auditoria(objetivo,actor,accion,cifrado) values(doc.id,ses.guardia,accion,guardia_private.cifrar(jsonb_build_object('coleccion',col,'anterior',anterior,'nuevo',nuevo)));
 update guardia_private.documentos set cifrado=guardia_private.cifrar(e),revision=doc.revision+1,actualizado=now() where id=doc.id;
 return jsonb_build_object('ok',true,'revision',doc.revision+1);
end; $$;
revoke all on function public.guardia_admin_rpc(jsonb) from public;
grant execute on function public.guardia_admin_rpc(jsonb) to anon,authenticated;
notify pgrst,'reload schema';

