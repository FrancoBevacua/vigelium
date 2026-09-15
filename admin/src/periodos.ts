import {horaCorte,limites,ventanaParaEntrega} from '../shared/informedia';
import type {EntradaDia,Ventana} from '../shared/informedia';
import {addDays,isoDate} from '../shared/model';
import type {Estado} from '../shared/model';

/** Igual que en el celular: se elige la fecha de entrega, no la de inicio. */
export const periodoParaDescarga = (S:Estado,fechaEntrega=isoDate()):Ventana =>
  ventanaParaEntrega(fechaEntrega,horaCorte(S),24);

export function periodosDeReportes(S:Estado,entradas:EntradaDia[]):Ventana[] {
  const corte=horaCorte(S),guardados=S.infdias.filter(i=>!i.deleted);
  const fechas=new Set([...entradas.map(e=>e.hora<corte?addDays(e.fecha,-1):e.fecha),...guardados.map(i=>i.fecha)]);
  const ventanas:Ventana[]=[...fechas].map(fecha=>({fecha,corte,duracion:24}));
  ventanas.push(...guardados.map(i=>({fecha:i.fecha,corte:i.desde,duracion:i.duracion??24})));
  return [...new Map(ventanas.map(v=>[v.fecha+'|'+v.corte+'|'+v.duracion,v])).values()]
    .sort((a,b)=>(b.fecha+b.corte).localeCompare(a.fecha+a.corte));
}

export const correspondeAEntrega = (v:Ventana,fechaEntrega:string) =>
  !fechaEntrega || limites(v).hasta.fecha===fechaEntrega;
