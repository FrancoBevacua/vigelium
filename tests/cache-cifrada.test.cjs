require('./register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Module=require('node:module');
const cargar=Module._load;
// Contrato estricto de Android y AES-GCM real, sin sustituir el código de la caché.
const aes={
 getRandomBytesAsync:async n=>crypto.randomBytes(n),
 AESKeySize:{AES256:256},
 AESEncryptionKey:{import:async(s,formato)=>Buffer.from(s,formato),generate:async()=>{const key=crypto.randomBytes(32);key.encoded=async formato=>key.toString(formato);return key;}},
 AESSealedData:{fromCombined(bytes){assert.ok(bytes instanceof Uint8Array,'Android exige ByteArray');return Buffer.from(bytes);}},
 async aesDecryptAsync(bytes,key){const d=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAuthTag(bytes.subarray(-16));return Buffer.concat([d.update(bytes.subarray(12,-16)),d.final()]);},
 async aesEncryptAsync(bytes,key){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const b=Buffer.concat([iv,c.update(bytes),c.final(),c.getAuthTag()]);return {combined:async()=>b.toString('base64')};}
};
const almacenamiento=new Map();
Module._load=function(name,...args){if(name==='@react-native-async-storage/async-storage')return {getItem:async k=>almacenamiento.get(k)||null,setItem:async(k,v)=>{almacenamiento.set(k,v);},removeItem:async k=>{almacenamiento.delete(k);}};return name==='expo-crypto'?aes:cargar.call(this,name,...args);};
const {abrirCache,sellarCache}=require('../src/cacheCifrada.ts');
const clave=crypto.randomBytes(32),sobre={estado:{guards:[],novedades:[{texto:'Información pendiente: acción'}]},guardia:'prueba',revision:2,numero:3};
test('recupera el formato Base64 anterior mediante bytes compatibles con Kotlin',async()=>{
 const original=await aes.aesEncryptAsync(Buffer.from(JSON.stringify(sobre)),clave);
 assert.deepEqual(await abrirCache(await original.combined(),clave),sobre);
});
test('cifra y recupera los cambios sin almacenar texto legible',async()=>{
 const guardado=await sellarCache(sobre,clave);assert.ok(!guardado.includes('Información'));assert.deepEqual(await abrirCache(guardado,clave),sobre);
});
test('clave incorrecta, corrupción o formato inválido producen un error breve sin revelar el cifrado',async()=>{
 const guardado=await sellarCache(sobre,clave),bytes=Buffer.from(guardado,'base64');bytes[20]^=1;
 for(const [valor,key] of [[guardado,crypto.randomBytes(32)],[bytes.toString('base64'),clave],['invalido',clave]]){
  await assert.rejects(abrirCache(valor,key),e=>e.message.length<180&&!e.message.includes(valor)&&e.message.includes('Se conserva intacta'));
 }
 assert.deepEqual(await abrirCache(guardado,clave),sobre);
});
test('acceso, escritura sin red, PIN incorrecto y reingreso recuperan la cola cifrada sin borrarla',async()=>{
 const nube=require('../src/nube.ts'),{estadoVacio}=require('../src/model.ts');
 let remoto=estadoVacio(),revision=1,sinRed=false;remoto.guards=[{id:'guardia-prueba',dni:'12345678',nombre:'Ana',apellido:'Prueba',cuenta:true,rol:'admin'}];
 const originalFetch=global.fetch;
 global.fetch=async(url,opciones)=>{
  const p=JSON.parse(opciones.body).p_request;let r={ok:true};
  if(p.accion==='ingresar')r=p.pin==='654321'?{ok:true,estado:remoto,guardia:'guardia-prueba',token:'sesion-prueba',revision}:{ok:false,error:'DNI o PIN incorrectos.'};
  if(p.accion==='consultar'){if(sinRed)throw new TypeError('sin red');r={ok:true,estado:remoto,revision};}
  if(p.accion==='guardar'){remoto=p.estado;r={ok:true,revision:++revision};}
  if(p.accion==='registrar')r={ok:false,error:'La cuenta existe.',codigo:'cuenta_existe'};
  return {ok:true,json:async()=>r};
 };
 try{
  await nube.iniciarNube();await nube.conectarTelefono();await nube.ingresarNube('12345678','654321');
  const local=JSON.parse(JSON.stringify(remoto));local.novedades=[{id:'pendiente',texto:'Novedad pendiente'}];sinRed=true;
  await assert.rejects(nube.guardarEnNube(local),/Revise Internet/);
  const {almacenLocal}=require('../src/almacenLocal.ts');
  const cifrado=await almacenLocal.getItem('guardia.nube.cola.v1');assert.ok(cifrado);assert.ok(!cifrado.includes('pendiente'));
  await assert.rejects(nube.ingresarNube('12345678','000000'),/PIN incorrectos/);assert.equal(await almacenLocal.getItem('guardia.nube.cola.v1'),cifrado);
  sinRed=false;const sesion=await nube.ingresarNube('12345678','654321');assert.equal(sesion.estado.novedades.length,1);assert.equal(await almacenLocal.getItem('guardia.nube.cola.v1'),null);
  await nube.cerrarSesionNube();const recuperada=await nube.registrarNube(remoto.guards[0],'654321');assert.equal(recuperada.guardia,'guardia-prueba');await nube.cerrarSesionNube();
 }finally{global.fetch=originalFetch;}
});
