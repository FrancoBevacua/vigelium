require('./register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reconciliarNube}=require('../src/reconciliarNube.ts');
const {COLS}=require('../src/model.ts');
const {ColaNube}=require('../src/colaNube.ts');
const copia=x=>JSON.parse(JSON.stringify(x));
function estado(){return {...Object.fromEntries(COLS.map(k=>[k,[]])),site:{cliente:'Prueba'},guards:[{id:'a',rol:'vigilador',nombre:'Ana',updatedAt:1}],updatedAt:1};}
test('recupera notas antiguas conservando el administrador y las cuentas del servidor',()=>{
 const local=estado(),remoto=estado();local.novedades.push({id:'n',texto:'Pendiente'});remoto.guards[0].rol='admin';remoto.guards[0].updatedAt=2;remoto.guards.push({id:'b',nombre:'Bruno'});
 const r=reconciliarNube(local,remoto);assert.equal(r.guards[0].rol,'admin');assert.equal(r.guards.length,2);assert.equal(r.novedades[0].texto,'Pendiente');assert.equal(remoto.novedades.length,0);
});
test('combina altas independientes de dos teléfonos y preserva el rol remoto',()=>{
 const base=estado(),local=copia(base),remoto=copia(base);local.novedades.push({id:'a',texto:'A'});remoto.novedades.push({id:'b',texto:'B'});local.guards[0].nombre='Ana María';remoto.guards[0].rol='admin';
 const r=reconciliarNube(local,remoto,base);assert.equal(r.novedades.length,2);assert.equal(r.guards[0].rol,'admin');assert.equal(r.guards[0].nombre,'Ana María');
});
test('rechaza modificaciones incompatibles del mismo texto',()=>{
 const base=estado();base.novedades=[{id:'a',texto:'Original'}];const local=copia(base),remoto=copia(base);local.novedades[0].texto='Uno';remoto.novedades[0].texto='Dos';assert.throws(()=>reconciliarNube(local,remoto,base),/ambos teléfonos/);
});
test('la cola recupera una revisión antigua y confirma los registros combinados',async()=>{
 const base=estado(),local=copia(base),remoto=copia(base);local.novedades.push({id:'a',texto:'A'});remoto.guards[0].rol='admin';let pendiente={estado:local,guardia:'a',revision:1,numero:7};let confirmado;
 const cola=new ColaNube({leer:async()=>copia(pendiente),escribir:async p=>{pendiente=copia(p);},quitar:async()=>{pendiente=null;},consultar:async()=>({estado:remoto,revision:2}),enviar:async p=>{assert.equal(p.revision,2);assert.equal(p.estado.guards[0].rol,'admin');return 3;},actor:()=> 'a',revision:()=>1,reconciliar:reconciliarNube,confirmar:(r,e)=>{confirmado=e;}});
 await cola.reintentar();assert.equal(pendiente,null);assert.equal(confirmado.novedades.length,1);
});
for(const perderRespuesta of [false,true])test(`una escritura concurrente conserva las notas del otro teléfono (respuesta perdida: ${perderRespuesta})`,async()=>{
 const base=estado(),local=copia(base);local.novedades.push({id:'a',texto:'A'});
 let remoto=copia(base),rev=2,cliente=1,pendiente=null,confirmado;remoto.novedades.push({id:'remota',texto:'Remota'});
 let liberar,comenzo;const esperando=new Promise(r=>comenzo=r),bloqueo=new Promise(r=>liberar=r);let primera=true;
 const cola=new ColaNube({leer:async()=>copia(pendiente),escribir:async p=>{pendiente=copia(p);},quitar:async()=>{pendiente=null;},consultar:async()=>({estado:copia(remoto),revision:rev}),enviar:async p=>{if(primera){primera=false;comenzo();await bloqueo;remoto=copia(p.estado);rev++;if(perderRespuesta)throw Error('respuesta perdida');return rev;}remoto=copia(p.estado);return ++rev;},actor:()=> 'a',revision:()=>cliente,base:()=>base,reconciliar:reconciliarNube,confirmar:(r,e)=>{cliente=r;confirmado=e;}});
 const a=cola.guardar(local);const resultado=a.catch(e=>e);await esperando;
 const siguiente=copia(local);siguiente.novedades.push({id:'segunda',texto:'Segunda'});const b=cola.guardar(siguiente);await new Promise(r=>setImmediate(r));liberar();await resultado;await b;
 assert.deepEqual(new Set(remoto.novedades.map(n=>n.id)),new Set(['a','segunda','remota']));assert.equal(pendiente,null);assert.equal(confirmado.novedades.length,3);
});
