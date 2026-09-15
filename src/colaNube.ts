import type { Estado } from './model';
export type SobreNube = { estado: Estado; guardia: string; revision: number; numero: number; enviado?: Estado; origenEnviado?:Estado; base?:Estado };
const ordenado = (v:any):any => Array.isArray(v) ? v.map(ordenado) : v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordenado(v[k])])) : v;
export const mismoEstado = (a:Estado,b:Estado) => JSON.stringify(ordenado(a))===JSON.stringify(ordenado(b));

/** El disco y la red usan colas distintas: una red lenta no retrasa la copia cifrada. */
export class ColaNube {
  private disco: Promise<any> = Promise.resolve();
  private red: Promise<any> = Promise.resolve();
  private numero=0;
  constructor(private io:{
    leer:()=>Promise<SobreNube|null>; escribir:(p:SobreNube)=>Promise<void>; quitar:()=>Promise<void>;
    consultar:()=>Promise<{estado:Estado;revision:number}>;
    enviar:(p:SobreNube)=>Promise<number>; actor:()=>string; revision:()=>number;
    confirmar:(rev:number,estado?:Estado)=>void;
    base?:()=>Estado|undefined;
    reconciliar?:(local:Estado,remoto:Estado,base?:Estado)=>Estado;
  }){}
  private exclusivo<T>(f:()=>Promise<T>):Promise<T>{const p=this.disco.catch(()=>{}).then(f);this.disco=p;return p;}
  guardar(estado:Estado,base?:Estado):Promise<void>{return this.encolar(estado,base).sincronizado;}
  encolar(estado:Estado,base?:Estado):{local:Promise<void>;sincronizado:Promise<void>}{
    const copia=JSON.parse(JSON.stringify(estado));const guardia=this.io.actor();
    const baseCopia=base?JSON.parse(JSON.stringify(base)):undefined;
    const listo=this.exclusivo(async()=>{
      const anterior=await this.io.leer();
      if(anterior && anterior.guardia!==guardia)throw new Error('El guardia anterior debe sincronizar sus cambios pendientes.');
      const numero=this.numero=Math.max(this.numero,anterior?.numero??0)+1;
      await this.io.escribir({estado:copia,guardia,numero,revision:anterior?.revision??this.io.revision(),enviado:anterior?.enviado,origenEnviado:anterior?.origenEnviado,base:baseCopia??anterior?.base??this.io.base?.()});
    });
    const enviado=this.red.catch(()=>{}).then(async()=>{await listo;await this.vaciar();});this.red=enviado;
    // Quien espera sólo el disco no debe producir un rechazo no manejado de red.
    enviado.catch(()=>{});
    return {local:listo,sincronizado:enviado};
  }
  reintentar():Promise<void>{const p=this.red.catch(()=>{}).then(()=>this.vaciar());this.red=p;return p;}
  async esperar(){await this.disco;await this.red;}
  private async vaciar(){
    for(;;){
      let p=await this.exclusivo(()=>this.io.leer());if(!p)return;
      if(!this.io.actor() || p.guardia!==this.io.actor())throw new Error('Ingrese con la cuenta que tiene cambios pendientes.');
      const servidor=await this.io.consultar();
      const origen=p.estado;
      if(mismoEstado(servidor.estado,p.estado)){
        await this.aceptar(p,servidor.revision);continue;
      }
      if(servidor.revision!==p.revision || (this.io.reconciliar&&p.base&&!mismoEstado(servidor.estado,p.base))){
        if(this.io.reconciliar || !p.enviado || !mismoEstado(servidor.estado,p.enviado)){
          if(!this.io.reconciliar)throw new Error('Hay cambios más recientes en la nube. Se conservó su copia cifrada y no se sobrescribió el historial.');
          const base=p.enviado&&mismoEstado(servidor.estado,p.enviado)?p.origenEnviado??p.enviado:p.base;
          const estado=this.io.reconciliar(p.estado,servidor.estado,base);
          const numero=p.numero;
          const actualizado=await this.exclusivo(async()=>{const actual=await this.io.leer();if(!actual||actual.numero!==numero)return false;await this.io.escribir({...actual,estado,base:servidor.estado,revision:servidor.revision,enviado:undefined});return true;});
          if(!actualizado)continue;
          p={...p,estado,base:servidor.estado,revision:servidor.revision,enviado:undefined};
        }
        p={...p,revision:servidor.revision};
      }
      const enviado=p;
      await this.exclusivo(async()=>{const actual=await this.io.leer();if(actual)await this.io.escribir({...actual,revision:enviado.revision,enviado:enviado.estado,origenEnviado:origen});});
      const revision=await this.io.enviar(enviado);
      await this.aceptar(enviado,revision,origen);
    }
  }
  private async aceptar(enviado:SobreNube,revision:number,origen:Estado=enviado.estado){
    this.io.confirmar(revision,enviado.estado);
    await this.exclusivo(async()=>{
      const actual=await this.io.leer();
      if(actual?.numero===enviado.numero)await this.io.quitar();
      else if(actual){
        const estado=this.io.reconciliar?this.io.reconciliar(actual.estado,enviado.estado,origen):actual.estado;
        await this.io.escribir({...actual,estado,revision,enviado:undefined,origenEnviado:undefined,base:enviado.estado});
      }
    });
  }
}
