import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import { Estado, Vigilador, estadoVacio } from './model';
import { leerBytes, bytesBase64 } from './media';
import { exportarVerificadores, verificarPIN } from './cuentas';
import { NUBE_URL, NUBE_PUBLICA } from './nubeConfig';
import { ColaNube, SobreNube } from './colaNube';
import {abrirCache,sellarCache} from './cacheCifrada';
import {CODIGO_CORPORATIVO} from './provisionCorporativa';
import {reconciliarNube} from './reconciliarNube';

const K_DISPOSITIVO = 'guardia.nube.dispositivo';
const K_VINCULO = 'guardia.nube.vinculado';
const K_LLAVE = 'guardia.nube.cache.llave';
const K_COLA = 'guardia.nube.cola.v1';
const leerSeguro = (k: string) => Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(k)) : SecureStore.getItemAsync(k);
const guardarSeguro = (k: string, v: string) => Platform.OS === 'web' ? Promise.resolve(localStorage.setItem(k,v)) : SecureStore.setItemAsync(k,v);
const aleatorio = async () => Array.from(await Crypto.getRandomBytesAsync(32)).map(b=>b.toString(16).padStart(2,'0')).join('');
type Respuesta = { ok: boolean; error?: string; codigo?: string; token?: string; guardia?: string; estado?: Estado; revision?: number; catalogo?: Partial<Estado>; vinculado?: boolean };
type Pendiente = SobreNube;
export type EstadoNube = { vinculada: boolean; guardando: boolean; pendiente: boolean; error: string; ultima: string; reautenticar?: boolean };
let estadoNube: EstadoNube = { vinculada:false, guardando:false, pendiente:false, error:'', ultima:'' };
let dispositivo = '', token = '', actor = '', revision = 0;
let baseConfirmada:Estado|undefined;
export const estadoConfirmado=()=>baseConfirmada?JSON.parse(JSON.stringify(baseConfirmada)) as Estado:undefined;
let llave: Promise<Crypto.AESEncryptionKey> | undefined;
const oyentes = new Set<(e: EstadoNube)=>void>();
export const verEstadoNube = () => estadoNube;
export const escucharNube = (f: (e: EstadoNube)=>void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
const avisar = (e: Partial<EstadoNube>) => { estadoNube={...estadoNube,...e}; oyentes.forEach(f=>f(estadoNube)); };
export async function iniciarNube() {
  dispositivo = await leerSeguro(K_DISPOSITIVO) || '';
  const vinculada = await leerSeguro(K_VINCULO) === '1';
  if (vinculada && !dispositivo) throw new Error('No está disponible la clave de este teléfono. Se necesita volver a vincularlo.');
  avisar({vinculada,pendiente:!!await AsyncStorage.getItem(K_COLA)});
  return vinculada;
}
export async function conectarTelefono(){
 if(!dispositivo){dispositivo=await aleatorio();await guardarSeguro(K_DISPOSITIVO,dispositivo);}
 await rpc({accion:'conectar',codigo:CODIGO_CORPORATIVO});
 await guardarSeguro(K_VINCULO,'1');avisar({vinculada:true});
}
/** Se ejecuta sólo al aplicar el reinicio de cuentas autorizado, antes de iniciar la nube. */
export async function reiniciarVinculoLocal(){
 await AsyncStorage.removeItem(K_COLA);
  for(const k of [K_DISPOSITIVO,K_VINCULO,K_LLAVE]) {
  if(Platform.OS==='web')localStorage.removeItem(k);else await SecureStore.deleteItemAsync(k);
 }
 dispositivo='';token='';actor='';revision=0;llave=undefined;
 avisar({vinculada:false,pendiente:false,guardando:false,error:'',ultima:'',reautenticar:false});
}
async function claveLocal() {
  if (!llave) llave=(async()=>{
    const existente=await leerSeguro(K_LLAVE);
    if (existente) return Crypto.AESEncryptionKey.import(existente,'hex');
    if (await AsyncStorage.getItem(K_COLA)) throw new Error('No se puede abrir la cola cifrada de este teléfono. No se reemplazaron sus datos.');
    const k=await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
    await guardarSeguro(K_LLAVE,await k.encoded('hex')); return k;
  })().catch(()=>{llave=undefined;throw Error('No se pudo acceder a la clave de la copia cifrada. Se conservaron sus datos. No desinstale la aplicación.');});
  return llave;
}
async function guardarCola(p: Pendiente) {
  await AsyncStorage.setItem(K_COLA,await sellarCache(p,await claveLocal()));
}
async function leerCola(): Promise<Pendiente | null> {
  const crudo=await AsyncStorage.getItem(K_COLA); if (!crudo) return null;
  return abrirCache(crudo,await claveLocal());
}
async function rpc(datos: Record<string, any>): Promise<Respuesta> {
  const abortar=new AbortController(); const timer=setTimeout(()=>abortar.abort(),120000);
  try {
    const r=await fetch(NUBE_URL+'/rest/v1/rpc/guardia_rpc',{method:'POST',headers:{apikey:NUBE_PUBLICA,'Content-Type':'application/json'},
      body:JSON.stringify({p_request:{...datos,dispositivo,token}}),signal:abortar.signal});
    const j=await r.json();
    if (!r.ok || !j.ok) {
      const error:any=new Error(j.error || (j.code==='P0001' ? j.message : '') || 'No se pudo conectar con la nube. Sus cambios pendientes permanecen cifrados en el teléfono.');
      error.codigo=j.codigo || j.code; if(error.codigo==='sesion')avisar({reautenticar:true}); throw error;
    }
    return j;
  } catch(e:any) {
    if (e.name==='AbortError' || e instanceof TypeError) throw new Error('No hay respuesta de la nube. Revise Internet y vuelva a intentar.');
    throw e;
  } finally {clearTimeout(timer);}
}
/** Todos los adjuntos viajan dentro del contenido cifrado, nunca como URL pública. */
export async function prepararEstadoNube(e: Estado): Promise<Estado> {
  const cache = new Map<string,string>();
  const convertir=async(v:any):Promise<any>=>{
    if (typeof v==='string' && /^(file:|content:|blob:)/.test(v)) {
      if (cache.has(v)) return cache.get(v);
      const mime=/\.pdf(?:\?|$)/i.test(v)?'application/pdf':/\.(jpe?g|png|webp)(?:\?|$)/i.test(v)?'image/'+(/\.png/i.test(v)?'png':/\.webp/i.test(v)?'webp':'jpeg'):'application/octet-stream';
      const data='data:'+mime+';base64,'+bytesBase64(await leerBytes(v)); cache.set(v,data);return data;
    }
    if (Array.isArray(v)) {const r=[];for(const x of v)r.push(await convertir(x));return r;}
    if(v && typeof v==='object'){const r:any={};for(const [k,x] of Object.entries(v))r[k]=await convertir(x);return r;}
    return v;
  };
  return convertir(e);
}
export async function catalogoNube(): Promise<Estado> {
  const r=await rpc({accion:'catalogo'}); return {...estadoVacio(),...r.catalogo};
}
async function adoptar(r: Respuesta) {
  if(!r.estado || !r.token || !r.guardia || !r.revision) throw new Error('La nube devolvió una sesión incompleta.');
  token=r.token;actor=r.guardia;revision=r.revision;
  baseConfirmada=JSON.parse(JSON.stringify(r.estado));
  avisar({reautenticar:false});
  const pendiente=await leerCola();
  if (pendiente) {
    if(pendiente.guardia!==actor) {throw new Error('El guardia anterior tiene cambios sin sincronizar. Debe ingresar con su cuenta y reintentarlos.');}
    else {
      try {
        await cola.reintentar();
        const actualizado=await consultarNube();r.estado=actualizado.estado;r.revision=revision;
        avisar({pendiente:false,error:''});
      } catch(e:any) {r.estado=pendiente.estado;avisar({pendiente:true,error:e.message});}
    }
  } else avisar({error:'',pendiente:false});
  return {estado:r.estado,guardia:actor};
}
export async function ingresarNube(dni: string, pin: string) {return adoptar(await rpc({accion:'ingresar',dni,pin}));}
export async function vincularCuentaNube(dni: string,pin: string,nombre: string,nacimiento: string) {return adoptar(await rpc({accion:'vincular_cuenta',dni,pin,nombre,nacimiento}));}
export async function registrarNube(perfil: Vigilador, pin: string) {
 if(await leerCola())throw Error('El guardia anterior tiene cambios pendientes. Debe ingresar y sincronizarlos antes de registrar otra cuenta.');
 const seguro=(await prepararEstadoNube({...estadoVacio(),guards:[perfil]})).guards[0];
 try{return await adoptar(await rpc({accion:'registrar',perfil:seguro,dni:perfil.dni,pin}));}
 catch(e:any){if(e.codigo==='cuenta_existe')return ingresarNube(perfil.dni!,pin);throw e;}
}
export async function vincularNube(codigo: string,e: Estado,g: Vigilador,pin:string) {
  if(!await verificarPIN(g.id,pin))throw new Error('El PIN actual no coincide.');
  if(!dispositivo){dispositivo=await aleatorio();await guardarSeguro(K_DISPOSITIVO,dispositivo);}
  const seguro=await prepararEstadoNube(e);
  const r=await rpc({accion:'vincular',codigo,estado:seguro,guardia:g.id,credenciales:await exportarVerificadores(e.guards)});
  const sesion=r.vinculado?await ingresarNube(g.dni!,pin):await adoptar(r);
  if(r.vinculado){await guardarEnNube(seguro);sesion.estado=seguro;}
  await guardarSeguro(K_VINCULO,'1');avisar({vinculada:true});
  await AsyncStorage.removeItem('consigna.estado.v1');await AsyncStorage.removeItem('consigna.sesion.v1');
  // Sólo las copias internas de adjuntos ya confirmadas en la nube; nunca la galería original.
  if(Platform.OS!=='web')for(const nombre of ['fotos','adjuntos']){
    const dir=new Directory(Paths.document,nombre);
    if(dir.uri.startsWith(Paths.document.uri) && dir.exists)try{dir.delete();}catch{avisar({error:'La nube está vinculada, pero no se pudieron retirar algunas copias locales anteriores.'});}
  }
  
  return sesion;
}
const cola=new ColaNube({leer:leerCola,escribir:async p=>{await guardarCola(p);avisar({pendiente:true});},
  quitar:async()=>{await AsyncStorage.removeItem(K_COLA);avisar({pendiente:false});},
  consultar:async()=>{const r=await rpc({accion:'consultar'});return {estado:r.estado!,revision:r.revision!};},
  enviar:async p=>(await rpc({accion:'guardar',estado:p.estado,revision:p.revision})).revision!,
  actor:()=>actor,revision:()=>revision,base:estadoConfirmado,reconciliar:reconciliarNube,
  confirmar:(rev,estado)=>{revision=rev;if(estado)baseConfirmada=JSON.parse(JSON.stringify(estado));avisar({ultima:new Date().toISOString()});}});
let trabajos=0;
let preparaciones:Promise<any>=Promise.resolve();
async function sincronizando(f:()=>Promise<void>){
  trabajos++;avisar({guardando:true,error:''});
  try{await f();if(!estadoNube.pendiente)avisar({error:''});}catch(e:any){avisar({error:e.message});throw e;}
  finally{trabajos--;avisar({guardando:trabajos>0});}
}
export async function guardarEnNube(e: Estado): Promise<void> {
  if(!token || !actor)throw new Error('Inicie sesión antes de sincronizar.');
  const copia=JSON.parse(JSON.stringify(e));
  const preparado=preparaciones.catch(()=>{}).then(()=>prepararEstadoNube(copia));preparaciones=preparado;
  return sincronizando(async()=>{await cola.guardar(await preparado);});
}
export async function reintentarNube(): Promise<void> {
  await sincronizando(()=>cola.reintentar());
}
export async function consultarNube(){const r=await rpc({accion:'consultar'});revision=r.revision!;baseConfirmada=JSON.parse(JSON.stringify(r.estado));return {estado:r.estado!,guardia:actor};}
export async function cerrarSesionNube() {
  await cola.esperar(); if(await leerCola())throw new Error('Sincronice los cambios pendientes antes de cerrar sesión.');
  await rpc({accion:'salir'});token='';actor='';revision=0;
}
export async function cambiarPinNube(actual: string,nuevo: string) {await rpc({accion:'cambiar_pin',actual,nuevo});}
export const borrarTemporalNube = (uri:string) => {if(Platform.OS!=='web' && uri.startsWith('file:'))try{const f=new File(uri);if(f.exists)f.delete();}catch{}};
