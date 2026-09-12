import { Novedad, Vigilador, Site, Acceso, accNormal } from './model';
import { textoIngresoAcceso, textoEgresoAcceso } from './text';

export const TITULO_REPORTE = 'LIBERTAD ROSARIO: REPORTE DIARIO';
export const CATEGORIAS_REPORTE = ['Novedad', 'Ingreso/Egreso', 'Adicional', 'Externos', 'Recorrido', 'Apertura', 'Cierre'];
export const apellidoNombre = (apellido:string, nombre:string) => [apellido.trim(),nombre.trim()].filter(Boolean).join(', ');
export type DatosAsiento = { apellido?:string; nombre?:string; movimiento?:'ingreso'|'egreso'; puestoId?:string; turno?:string; lugar?:string; observaciones?:string; acceso?:string; tipoExterno?:string };
export function categoriaAsiento(n: Pick<Novedad,'categoria'|'texto'|'origenTipo'|'visitId'|'mov'>): string {
  const c=(n.categoria||'').toLowerCase();
  if(n.visitId || ['externo','externos'].includes(c))return 'EXTERNO';
  if(c.includes('adicional')||n.origenTipo==='policial')return 'ADICIONAL';
  if(c.includes('recorrido')||n.origenTipo==='recorrido')return 'RECORRIDO';
  if(c.includes('apertura'))return 'APERTURA';
  if(c.includes('cierre'))return 'CIERRE';
  if(['ingreso','egreso'].includes(c))return c.toUpperCase();
  if(c==='relevo' || n.origenTipo==='guardia')return /egreso|se retira|egresa/i.test(n.texto)?'EGRESO':'INGRESO';
  return 'NOVEDAD';
}
export function redactarAsiento(categoria:string,d:DatosAsiento,acc:Acceso=accNormal(),puesto='') {
 const persona=apellidoNombre(d.apellido||'',d.nombre||'');const ingreso=d.movimiento!=='egreso';
 if(['Ingreso/Egreso','Adicional'].includes(categoria)&&(!d.apellido?.trim()||!d.nombre?.trim()||(ingreso&&!d.turno?.trim())))return '';
 if(categoria==='Ingreso/Egreso'&&ingreso&&!puesto)return '';
 if(['Apertura','Cierre'].includes(categoria)&&!d.acceso?.trim())return '';
 if(categoria==='Ingreso/Egreso')return ingreso?'Ingresa Gs '+persona+' al puesto '+puesto+'. Turno: '+d.turno+'.':'Se retira Gs '+persona+'.';
 if(categoria==='Adicional')return (ingreso?'Ingresa adicional policial ':'Se retira adicional policial ')+persona+(ingreso?'. Turno: '+d.turno:'')+'.';
 if(categoria==='Externos')return ingreso?textoIngresoAcceso(acc,d.tipoExterno||'Visita'):textoEgresoAcceso(acc,d.tipoExterno||'Visita',null);
 if(categoria==='Recorrido'){const lugar=d.lugar?.trim()||'el paseo';return 'Se realiza recorrido '+(lugar.startsWith('el ')?'del '+lugar.slice(3):'de '+lugar)+'. '+(d.observaciones?.trim()||'Sin novedades.');}
 if(categoria==='Apertura'||categoria==='Cierre'){
  const acceso=d.acceso!.trim();
  const complemento=/^port[oó]n\s/i.test(acceso)?'del portón '+acceso.replace(/^port[oó]n\s+/i,''):/^puerta\s/i.test(acceso)?'de la puerta '+acceso.replace(/^puerta\s+/i,''):'de '+acceso;
  return (categoria==='Apertura'?'Se procede a la apertura ':'Se procede al cierre ')+complemento+'.'+(d.observaciones?.trim()?' '+d.observaciones.trim():'');
 }
 return d.observaciones?.trim()||'';
}
export function numeroSupervisor(v:string){const n=v.replace(/[^0-9]/g,'');if(!/^[1-9][0-9]{7,14}$/.test(n))throw new Error('Ingrese el número del supervisor con código de país.');return n;}
export const nombreArchivoReporte=(fecha:string)=>'LIBERTAD ROSARIO - REPORTE DIARIO '+fecha+'.pdf';
