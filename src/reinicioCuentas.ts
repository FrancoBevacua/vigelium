import {Estado,estadoVacio} from './model';

// Reinicio único solicitado por el propietario el 11/09/2026.
export const REINICIO_CUENTAS = 'vigelium.reinicio-cuentas.2026-09-11';
export function sinCuentasNiHistorial(anterior:Estado):Estado {
 const limpio=estadoVacio();
 limpio.site={...limpio.site,...anterior.site};
 for(const k of ['posts','franjas','directives','accesses','rtemplates','contacts','locales'] as const)
  (limpio as any)[k]=JSON.parse(JSON.stringify(anterior[k]||[]));
 return limpio;
}
type Almacen={getItem:(k:string)=>Promise<string|null>;setItem:(k:string,v:string)=>Promise<unknown>;removeItem:(k:string)=>Promise<unknown>};
export async function reiniciarCuentasUnaVez(a:Almacen,borrarPin:(id:string)=>Promise<void>,desvincular:()=>Promise<void>){
 if(await a.getItem(REINICIO_CUENTAS)==='1')return false;
 const crudo=await a.getItem('consigna.estado.v1');
 const anterior:Estado=crudo?JSON.parse(crudo):estadoVacio();
 // Los PIN se retiran antes de los perfiles, para que un reintento pueda encontrarlos.
 for(const g of anterior.guards||[])await borrarPin(g.id);
 await a.setItem('consigna.estado.v1',JSON.stringify(sinCuentasNiHistorial(anterior)));
 await a.removeItem('consigna.sesion.v1');
 await desvincular();
 await a.setItem(REINICIO_CUENTAS,'1');
 return true;
}
