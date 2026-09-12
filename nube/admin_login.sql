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
