-- Registro inicial sin administrador previo. No concede roles desde el cliente.
begin;
do $migracion$
declare definicion text:=pg_get_functiondef('public.guardia_rpc(jsonb)'::regprocedure);
begin
 definicion:=replace(definicion, 'where x->>''id''=actor and x->>''rol''=''admin'' and (x->>''cuenta'')::boolean', 'where x->>''id''=actor and (x->>''cuenta'')::boolean');
 definicion:=replace(definicion,'Vinculá primero el DNI de la cuenta administradora','Complete el DNI de su cuenta para la conexión inicial');
 if position('jsonb_agg(x||jsonb_build_object(''rol'',''vigilador''))' in definicion)=0 then
  definicion:=replace(definicion,
   '     insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(estado))',
   '     estado:=jsonb_set(estado,''{guards}'',(select jsonb_agg(x||jsonb_build_object(''rol'',''vigilador'')) from jsonb_array_elements(estado->''guards'') x));'||chr(10)||
   '     insert into guardia_private.documentos(cifrado) values(guardia_private.cifrar(estado))');
 end if;
 if position('jsonb_agg(x||jsonb_build_object(''rol'',''vigilador''))' in definicion)=0 or position('cuenta administradora' in definicion)>0 then raise exception 'Versión de API no compatible'; end if;
 execute definicion;
end;
$migracion$;

-- Sólo el propietario desde SQL Editor puede asignar el rol, después del alta.
create or replace function guardia_private.asignar_administrador(objetivo_id uuid, guardia_id text) returns void
language plpgsql security definer set search_path='' as $$
declare e jsonb;
begin
 select guardia_private.abrir(cifrado) into e from guardia_private.documentos where id=objetivo_id for update;
 if e is null or not exists(select 1 from jsonb_array_elements(e->'guards') x where x->>'id'=guardia_id and coalesce((x->>'cuenta')::boolean,false) and not coalesce((x->>'deleted')::boolean,false)) then raise exception 'Cuenta no encontrada'; end if;
 e:=jsonb_set(e,'{guards}',(select jsonb_agg(case when x->>'id'=guardia_id then x||jsonb_build_object('rol','admin','updatedAt',floor(extract(epoch from clock_timestamp())*1000)) else x end) from jsonb_array_elements(e->'guards') x));
 update guardia_private.documentos set cifrado=guardia_private.cifrar(e),revision=revision+1,actualizado=now() where id=objetivo_id;
end;
$$;
revoke all on function guardia_private.asignar_administrador(uuid,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
