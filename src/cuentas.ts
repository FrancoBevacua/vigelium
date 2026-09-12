import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const leer = (k: string) => Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(k)) : SecureStore.getItemAsync(k);
const escribir = (k: string, v: string) => Platform.OS === 'web' ? Promise.resolve(localStorage.setItem(k, v)) : SecureStore.setItemAsync(k, v);
const clave = (id: string) => 'securia.pin.' + id;
export async function borrarPIN(id:string){
 for(const k of [clave(id),clave(id)+'.intentos']) {
  if(Platform.OS==='web')localStorage.removeItem(k);else await SecureStore.deleteItemAsync(k);
 }
}
const digest = (sal: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sal + ':' + pin);
export const legajoNormal = (s: string) => s.trim().toUpperCase();
export async function tienePIN(id: string) { return !!await leer(clave(id)); }
export async function guardarPIN(id: string, pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('El PIN debe tener entre 4 y 6 dígitos.');
  const sal = Array.from(await Crypto.getRandomBytesAsync(16)).map(b => b.toString(16).padStart(2, '0')).join('');
  await escribir(clave(id), JSON.stringify({ sal, hash: await digest(sal, pin) }));
  await escribir(clave(id) + '.intentos', JSON.stringify({ n: 0, hasta: 0 }));
}
export async function verificarPIN(id: string, pin: string): Promise<boolean> {
  const datos = await leer(clave(id));
  if (!datos) throw new Error('Esta cuenta todavía no tiene PIN. Usá «Configurar cuenta anterior».');
  const intentos = JSON.parse(await leer(clave(id) + '.intentos') || '{"n":0,"hasta":0}');
  if (intentos.hasta > Date.now()) throw new Error('Demasiados intentos. Espere un minuto antes de volver a ingresar.');
  const c = JSON.parse(datos);
  const esperado = await digest(c.sal, pin);
  let diferencia = esperado.length ^ c.hash.length;
  for (let i = 0; i < esperado.length; i++) diferencia |= esperado.charCodeAt(i) ^ (c.hash.charCodeAt(i) || 0);
  const ok = diferencia === 0;
  const n = ok ? 0 : intentos.n + 1;
  await escribir(clave(id) + '.intentos', JSON.stringify({ n: n >= 5 ? 0 : n, hasta: !ok && n >= 5 ? Date.now() + 60000 : 0 }));
  return ok;
}

export const dniNormal = (s: string) => String(s || '').replace(/[.\s]/g, '');
export const dniValido = (s: string) => /^[0-9]{7,8}$/.test(dniNormal(s)) && !/^0+$/.test(dniNormal(s));

/** Se migra el verificador, nunca el PIN. El servidor lo protege además con bcrypt y pepper. */
export async function exportarVerificadores(guards: {id:string;cuenta?:boolean;deleted?:boolean}[]) {
  const r=[];
  for(const g of guards.filter(x=>x.cuenta && !x.deleted)) {
    const raw=await leer(clave(g.id));
    if(!raw)throw new Error('Una cuenta anterior todavía no tiene PIN. Debe configurarlo antes de vincular el teléfono.');
    const v=JSON.parse(raw);r.push({id:g.id,sal:v.sal,hash:v.hash});
  }
  return r;
}
