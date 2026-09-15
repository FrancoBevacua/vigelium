// Adaptador del puente nativo: ejecuta SQLite real sobre un archivo temporal.
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vigelium-sqlite-'));
const conexiones=new Map();
module.exports={dir,conexiones,async openDatabaseAsync(nombre){
 const ruta=path.join(dir,nombre),native=new DatabaseSync(ruta);
 const db={native,ruta,execAsync:async sql=>native.exec(sql),runAsync:async(sql,...args)=>native.prepare(sql).run(...args),getFirstAsync:async(sql,...args)=>native.prepare(sql).get(...args)||null,closeAsync:async()=>native.close()};
 conexiones.set(nombre,db);return db;
}};
