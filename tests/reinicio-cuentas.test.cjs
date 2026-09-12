const stubs=require('./register.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {estadoVacio}=require('../src/model.ts');
const {sinCuentasNiHistorial,reiniciarCuentasUnaVez,REINICIO_CUENTAS}=require('../src/reinicioCuentas.ts');
function almacen(){const datos=new Map();return {datos,getItem:async k=>datos.get(k)||null,setItem:async(k,v)=>{datos.set(k,v);},removeItem:async k=>{datos.delete(k);}};}
test('el PIN anterior deja de existir y el reinicio no borra otras configuraciones seguras',async()=>{
 const cuentas=require('../src/cuentas.ts');await cuentas.guardarPIN('anterior','123456');stubs.memoria.set('configuracion-ajena','conservar');
 assert.equal(await cuentas.tienePIN('anterior'),true);await cuentas.borrarPIN('anterior');
 assert.equal(await cuentas.tienePIN('anterior'),false);assert.equal(stubs.memoria.has('securia.pin.anterior.intentos'),false);assert.equal(stubs.memoria.get('configuracion-ajena'),'conservar');
});
test('el reinicio retira todas las cuentas e historial sin borrar el catálogo de puestos',()=>{
 const anterior=estadoVacio();anterior.guards=[{id:'admin-desconocido',cuenta:true,rol:'admin'},{id:'guardia'}];anterior.novedades=[{id:'n'}];anterior.punches=[{id:'turno'}];anterior.posts=[{id:'p',nombre:'Paseo'}];anterior.directives=[{id:'d',nombre:'Apertura'}];
 const limpio=sinCuentasNiHistorial(anterior);assert.deepEqual(limpio.guards,[]);assert.deepEqual(limpio.novedades,[]);assert.deepEqual(limpio.punches,[]);assert.deepEqual(limpio.posts,anterior.posts);assert.deepEqual(limpio.directives,anterior.directives);assert.equal(anterior.guards.length,2);
});
test('el reinicio se aplica una vez y conserva la cuenta creada después de actualizar',async()=>{
 const a=almacen(),S=estadoVacio(),borrados=[];S.guards=[{id:'vieja'}];await a.setItem('consigna.estado.v1',JSON.stringify(S));await a.setItem('consigna.sesion.v1','vieja');let desvinculados=0;
 assert.equal(await reiniciarCuentasUnaVez(a,async id=>{borrados.push(id);},async()=>{desvinculados++;}),true);
 assert.deepEqual(borrados,['vieja']);assert.equal(await a.getItem('consigna.sesion.v1'),null);assert.equal(desvinculados,1);
 S.guards=[{id:'nueva',cuenta:true,rol:'vigilador'}];await a.setItem('consigna.estado.v1',JSON.stringify(S));
 assert.equal(await reiniciarCuentasUnaVez(a,async()=>assert.fail('No borrar la cuenta nueva'),async()=>assert.fail('No desvincular de nuevo')),false);assert.equal(JSON.parse(await a.getItem('consigna.estado.v1')).guards[0].id,'nueva');
});
test('un fallo de limpieza no marca el reinicio como terminado y permite reintentar',async()=>{
 const a=almacen();await assert.rejects(reiniciarCuentasUnaVez(a,async()=>{},async()=>{throw Error('Almacenamiento no disponible');}),/Almacenamiento/);
 assert.equal(await a.getItem(REINICIO_CUENTAS),null);assert.equal(await reiniciarCuentasUnaVez(a,async()=>{},async()=>{}),true);
});
