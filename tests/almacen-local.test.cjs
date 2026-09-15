require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const anterior=new Map();let fallaBorrado=false;const load=Module._load;
Module._load=function(n,...a){if(n==='@react-native-async-storage/async-storage')return {getItem:async k=>anterior.get(k)??null,removeItem:async k=>{if(fallaBorrado)throw Error('sin espacio');anterior.delete(k);}};return load.call(this,n,...a);};
const {almacenLocal}=require('../src/almacenLocal.ts');
const sqlite=require('./sqlite-native.cjs');
test('migra una cola de más de 10 MB y la recupera desde otra conexión al archivo',async()=>{
 const valor='cifrado:á'.repeat(1400000);anterior.set('cola-grande',valor);
 assert.equal(await almacenLocal.getItem('cola-grande'),valor);assert.equal(anterior.has('cola-grande'),false);
 const {DatabaseSync}=require('node:sqlite');const otra=new DatabaseSync(sqlite.conexiones.get('vigelium-datos.db').ruta);
 try{assert.equal(otra.prepare('SELECT valor FROM documentos WHERE clave=?').get('cola-grande').valor,valor);}finally{otra.close();}
});
test('una limpieza fallida no resucita la cola migrada y confirmada',async()=>{
 fallaBorrado=true;anterior.set('cola-vieja','cifrado original');
 assert.equal(await almacenLocal.getItem('cola-vieja'),'cifrado original');await almacenLocal.removeItem('cola-vieja');
 assert.equal(anterior.get('cola-vieja'),'cifrado original');assert.equal(await almacenLocal.getItem('cola-vieja'),null);fallaBorrado=false;
});
test('un SQLITE_FULL real rechaza la escritura y mantiene la copia anterior',async()=>{
 await almacenLocal.setItem('critica','última confirmada');const d=sqlite.conexiones.get('vigelium-datos.db').native;
 const paginas=d.prepare('PRAGMA page_count').get().page_count;d.exec('PRAGMA max_page_count = '+paginas);
 await assert.rejects(almacenLocal.setItem('critica','nuevo'.repeat(5000000)),/full/i);
 assert.equal(await almacenLocal.getItem('critica'),'última confirmada');d.exec('PRAGMA max_page_count = 1073741823');
});
test('si falla la migración se conserva el original en AsyncStorage',async()=>{
 const d=sqlite.conexiones.get('vigelium-datos.db').native,paginas=d.prepare('PRAGMA page_count').get().page_count;d.exec('PRAGMA max_page_count = '+paginas);
 anterior.set('migracion-fallida','datos'.repeat(5000000));await assert.rejects(almacenLocal.getItem('migracion-fallida'),/full/i);
 assert.ok(anterior.has('migracion-fallida'));d.exec('PRAGMA max_page_count = 1073741823');
});
