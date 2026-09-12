import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
const SESSION='vigelium_admin';
export function seal(value,secret){const iv=randomBytes(12),key=createHash('sha256').update(secret).digest(),c=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(JSON.stringify(value)),c.final(),c.getAuthTag()]).toString('base64url');}
export function unseal(value,secret){try{const b=Buffer.from(value,'base64url'),d=createDecipheriv('aes-256-gcm',createHash('sha256').update(secret).digest(),b.subarray(0,12));d.setAuthTag(b.subarray(-16));const s=JSON.parse(Buffer.concat([d.update(b.subarray(12,-16)),d.final()]));return s.exp>Date.now()?s:null;}catch{return null;}}
export function sameOrigin(req){const origin=req.headers.origin;return typeof origin==='string'&&new URL(origin).host===req.headers.host;}
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
 try{
  if(!sameOrigin(req))return res.status(403).json({error:'Origen no autorizado.'});
  const env=process.env;
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLIC_KEY||!env.CORPORATE_CODE||!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return res.status(503).json({error:'El panel aún no tiene configurada su conexión segura.'});
  const p=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!p||JSON.stringify(p).length>3300000)return res.status(413).json({error:'Solicitud demasiado grande.'});
  const rpc=async(name,data)=>{const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.SUPABASE_PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_request:data}),signal:AbortSignal.timeout(25000)});const j=await r.json();if(!r.ok)throw Error(j.code==='P0001'?j.message:'No se pudo consultar el servicio.');return j;};
  const secure=env.VERCEL?' Secure;':'';
  const cookie=(name,value,age)=>`${name}=${value}; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=${age}`;
  const cs=cookies(req);
  if(p.accion==='ingresar'){
   if(!/^[0-9]{7,8}$/.test(p.dni||'')||!/^[0-9]{4,6}$/.test(p.pin||''))return res.status(400).json({error:'Ingrese DNI y PIN válidos.'});
   const dispositivo=/^[a-f0-9]{64}$/.test(cs.vigelium_dispositivo||'')?cs.vigelium_dispositivo:randomBytes(32).toString('hex');
   res.setHeader('Set-Cookie',cookie('vigelium_dispositivo',dispositivo,31536000));
   const vinculacion=await rpc('guardia_rpc',{accion:'conectar',dispositivo,codigo:env.CORPORATE_CODE});if(!vinculacion.ok)return res.status(503).json({error:vinculacion.error});
   const r=await rpc('guardia_admin_rpc',{accion:'ingresar',dispositivo,dni:p.dni,pin:p.pin});
   if(!r.ok)return res.status(401).json({error:r.error});
   const sesion=seal({dispositivo,token:r.token,exp:Date.now()+8*3600000},env.SESSION_SECRET);
   res.setHeader('Set-Cookie',[cookie('vigelium_dispositivo',dispositivo,31536000),cookie(SESSION,sesion,8*3600)]);
   return res.status(200).json({ok:true});
  }
  const s=unseal(cs[SESSION]||'',env.SESSION_SECRET);
  if(!s)return res.status(401).json({error:'Inicie sesión para acceder al panel.'});
  const permitidas=['consultar','foto','editar_asiento','eliminar_asiento','crear_cuenta','editar_cuenta','eliminar_cuenta','salir'];
  if(!permitidas.includes(p.accion))return res.status(400).json({error:'Operación no disponible.'});
  const r=await rpc('guardia_admin_rpc',{...p,dispositivo:s.dispositivo,token:s.token});
  if(p.accion==='salir'||r.codigo==='sesion'||r.codigo==='prohibido')res.setHeader('Set-Cookie',cookie(SESSION,'',0));
  return res.status(r.ok?200:r.codigo==='conflicto'?409:['sesion','prohibido'].includes(r.codigo)?401:400).json(r);
 }catch(e){const message=String(e.message||'');return res.status(400).json({error:message.length<200&&!/fetch|timeout|json|token|secret/i.test(message)?message:'No se pudo completar la operación. Vuelva a intentar.'});}
}
