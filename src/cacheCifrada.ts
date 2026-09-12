import * as Crypto from 'expo-crypto';
import type {SobreNube} from './colaNube';

// Android recibe ByteArray. No pasar directamente el texto Base64 al puente Kotlin.
export function bytesDesdeBase64(texto:string):Uint8Array {
 if(!texto||texto.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(texto))throw Error('Formato cifrado no válido.');
 const binario=atob(texto),bytes=new Uint8Array(binario.length);
 for(let i=0;i<binario.length;i++)bytes[i]=binario.charCodeAt(i);
 return bytes;
}
export async function abrirCache(texto:string,clave:Crypto.AESEncryptionKey):Promise<SobreNube>{
 try{
  const bytes=bytesDesdeBase64(texto);
  const claro=await Crypto.aesDecryptAsync(Crypto.AESSealedData.fromCombined(bytes),clave);
  const p=JSON.parse(new TextDecoder().decode(claro));
  if(!p||typeof p!=='object'||typeof p.guardia!=='string'||!p.estado||typeof p.estado!=='object'||Array.isArray(p.estado)||!Number.isInteger(p.revision))throw Error();
  return p;
 }catch{throw Error('No se pudo abrir la copia cifrada del teléfono. Se conserva intacta. No borre los datos ni desinstale la aplicación.');}
}
export async function sellarCache(p:SobreNube,clave:Crypto.AESEncryptionKey):Promise<string>{
 try{const cifrado=await Crypto.aesEncryptAsync(new TextEncoder().encode(JSON.stringify(p)),clave);return await cifrado.combined('base64');}
 catch{throw Error('No se pudo guardar la copia cifrada del teléfono. Vuelva a intentar.');}
}
