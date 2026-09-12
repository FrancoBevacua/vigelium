import {Estado,COLS} from './model';
const igual=(a:any,b:any):boolean=>{
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&igual(a[k],b[k]));
};
const conflicto=()=>{throw Error('El mismo registro cambió en ambos teléfonos. Se conserva la copia cifrada; no se sobrescribió el informe.');};
function combinar(base:any,local:any,remoto:any,ruta:string[]):any{
 const k=ruta[ruta.length-1];
 if(ruta[0]==='guards'&&['rol','dni','cuenta'].includes(k))return remoto;
 if(k==='updatedAt')return Math.max(local||0,remoto||0);
 if(igual(local,base)||igual(local,remoto))return remoto;
 if(igual(remoto,base))return local;
 if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remoto)&&[...base,...local,...remoto].every(v=>v&&typeof v.id==='string')){
  const b=new Map(base.map(x=>[x.id,x])),l=new Map(local.map(x=>[x.id,x])),r=new Map(remoto.map(x=>[x.id,x]));
  return [...new Set([...r.keys(),...l.keys()])].map(id=>{
   if(!b.has(id)){if(l.has(id)&&r.has(id)&&!igual(l.get(id),r.get(id)))return conflicto();return r.get(id)||l.get(id);}
   if(!l.has(id)||!r.has(id))return conflicto();
   return combinar(b.get(id),l.get(id),r.get(id),[...ruta,id]);
  });
 }
 if(base&&local&&remoto&&[base,local,remoto].every(v=>typeof v==='object'&&!Array.isArray(v))){
  const resultado:any={};for(const clave of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remoto)])){
   const valor=combinar(base[clave],local[clave],remoto[clave],[...ruta,clave]);if(valor!==undefined)resultado[clave]=valor;
  }return resultado;
 }
 return conflicto();
}
export function reconciliarNube(local:Estado,remoto:Estado,base?:Estado):Estado{
 if(base)return combinar(base,local,remoto,[]);
 // Colas antiguas: sólo recuperar altas sin colisiones; las identidades vienen del servidor.
 if(!Array.isArray(local.guards)||!Array.isArray(remoto.guards))return conflicto();
 const salida=JSON.parse(JSON.stringify(remoto));
 const limpiar=(x:any,identidad=false)=>{const r={...x};delete r.updatedAt;if(identidad)for(const k of ['rol','dni','cuenta'])delete r[k];return r;};
 if(!igual(local.site,remoto.site))return conflicto();
 for(const col of COLS){
  for(const registro of local[col]||[]){
   const otro=remoto[col].find((x:any)=>x.id===registro.id);
   if(!otro){salida[col].push(registro);continue;}
   if(!igual(limpiar(registro,col==='guards'),limpiar(otro,col==='guards')))return conflicto();
  }
 }
 salida.updatedAt=Math.max(local.updatedAt||0,remoto.updatedAt||0);return salida;
}
