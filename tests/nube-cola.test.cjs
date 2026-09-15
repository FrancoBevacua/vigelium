require('./register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ColaNube}=require('../src/colaNube.ts');
const clonar=x=>x==null?x:JSON.parse(JSON.stringify(x));
const pausa=()=>new Promise(r=>setImmediate(r));
test('el guardado local se confirma sin esperar Internet y nunca oculta un fallo de disco',async()=>{
 const {s,io}=escenario();let liberar;io.consultar=()=>new Promise(r=>{liberar=()=>r({estado:s.estado,revision:s.revision});});
 const cola=new ColaNube(io),a=cola.encolar({n:1});await a.local;await pausa();assert.equal(s.local.estado.n,1);
 liberar();await a.sincronizado;
 io.escribir=async()=>{throw Error('SQLITE_FULL');};const b=cola.encolar({n:2});await assert.rejects(b.local,/SQLITE_FULL/);await assert.rejects(b.sincronizado,/SQLITE_FULL/);
});
function escenario(){
 const s={local:null,estado:{n:0},revision:1,cliente:1,actor:'a',enviados:[]};
 const io={leer:async()=>clonar(s.local),escribir:async p=>{s.local=clonar(p);},quitar:async()=>{s.local=null;},
 consultar:async()=>({estado:clonar(s.estado),revision:s.revision}),
 enviar:async p=>{assert.equal(p.revision,s.revision);s.estado=clonar(p.estado);s.enviados.push(p.estado.n);return ++s.revision;},
 actor:()=>s.actor,revision:()=>s.cliente,confirmar:r=>{s.cliente=r;}};
 return {s,io};
}
test('la segunda novedad se guarda en disco mientras la primera espera Internet',async()=>{
 const {s,io}=escenario();let liberar;const espera=new Promise(r=>liberar=r);const enviar=io.enviar;
 io.enviar=async p=>{if(p.estado.n===1)await espera;return enviar(p);};const cola=new ColaNube(io);
 const a=cola.guardar({n:1});await pausa();const b=cola.guardar({n:2});await pausa();
 assert.equal(s.local.estado.n,2);assert.equal(s.estado.n,0);liberar();await Promise.all([a,b]);
 assert.equal(s.estado.n,2);assert.equal(s.local,null);assert.deepEqual(s.enviados,[1,2]);
});
test('una respuesta perdida se recupera sin duplicar ni perder la siguiente novedad',async()=>{
 const {s,io}=escenario();const enviar=io.enviar;let falla=true;
 io.enviar=async p=>{const rev=await enviar(p);if(falla){falla=false;throw Error('respuesta perdida');}return rev;};
 const cola=new ColaNube(io);await assert.rejects(cola.guardar({n:1}),/perdida/);
 assert.equal(s.local.estado.n,1);await cola.guardar({n:2});assert.equal(s.estado.n,2);assert.equal(s.local,null);
 assert.deepEqual(s.enviados,[1,2]);
});
test('un conflicto real conserva la copia local y el historial remoto',async()=>{
 const {s,io}=escenario();s.local={estado:{n:1},guardia:'a',revision:1,numero:1};s.estado={n:99};s.revision=2;
 await assert.rejects(new ColaNube(io).reintentar(),/más recientes/);
 assert.equal(s.local.estado.n,1);assert.equal(s.estado.n,99);assert.deepEqual(s.enviados,[]);
});
test('otro guardia no puede reemplazar los cambios pendientes del anterior',async()=>{
 const {s,io}=escenario();s.local={estado:{n:1},guardia:'anterior',revision:1,numero:9};
 await assert.rejects(new ColaNube(io).guardar({n:2}),/anterior/);assert.equal(s.local.estado.n,1);
});
test('el reintento después de reiniciar confirma una escritura ya recibida',async()=>{
 const {s,io}=escenario();s.local={estado:{n:1},guardia:'a',revision:1,numero:9};s.estado={n:1};s.revision=2;
 const cola=new ColaNube(io);await cola.reintentar();await cola.esperar();assert.equal(s.local,null);assert.equal(s.cliente,2);
 assert.deepEqual(s.enviados,[]);
});
test('una respuesta de antes del reinicio no borra la nueva escritura',async()=>{
 const {s,io}=escenario();s.local={estado:{n:1},guardia:'a',revision:1,numero:1};
 let liberar,comenzo;const listo=new Promise(r=>comenzo=r),bloqueo=new Promise(r=>liberar=r),enviar=io.enviar;
 io.enviar=async p=>{if(p.estado.n===1){comenzo();await bloqueo;}return enviar(p);};
 const cola=new ColaNube(io),viejo=cola.reintentar();await listo;const nuevo=cola.encolar({n:2});await nuevo.local;
 assert.ok(s.local.numero>1);liberar();await viejo;await nuevo.sincronizado;assert.equal(s.estado.n,2);assert.equal(s.local,null);
});
