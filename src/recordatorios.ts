// En expo-calendar 57.0.3 la API Next de Android no invierte relativeOffset
// al escribir CalendarContract.Reminders.MINUTES. Legacy sí conserva el
// contrato documentado: -15 significa avisar 15 minutos antes.
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';
import { fechaValida, horaValida } from './servicio';

export type DatosRecordatorio={titulo:string;notas:string;fecha:string;hora:string;minutosAviso:number};
export const marcaRecordatorio=(guardia:string)=>'[VIGELIUM:recordatorio:'+guardia+']';
export const esRecordatorio=(notas:string|null|undefined,guardia:string)=>!!guardia&&(notas||'').split('\n').includes(marcaRecordatorio(guardia));
export function datosEvento(datos:DatosRecordatorio,guardia:string) {
  if(!guardia)throw Error('Inicie sesión para crear recordatorios.');
  if(!datos.titulo.trim())throw Error('Escriba el título del recordatorio.');
  if(!fechaValida(datos.fecha)||!horaValida(datos.hora))throw Error('Revise la fecha (AAAA-MM-DD) y la hora (HH:MM).');
  if(![0,5,15,30,60].includes(datos.minutosAviso))throw Error('Seleccione una anticipación válida.');
  const startDate=new Date(datos.fecha+'T'+datos.hora+':00');
  return {title:datos.titulo.trim(),notes:datos.notas.trim()+'\n'+marcaRecordatorio(guardia),startDate,
    endDate:new Date(startDate.getTime()+15*60000),allDay:false,alarms:[{relativeOffset:-datos.minutosAviso,method:Calendar.AlarmMethod.ALERT}]};
}
export async function calendariosDisponibles() {
  const calendarios=(await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).filter(c=>c.allowsModifications);
  let preferido='';
  if(Platform.OS==='ios')try{preferido=(await Calendar.getDefaultCalendarAsync()).id;}catch{}
  return calendarios.sort((a,b)=>Number(b.id===preferido||b.isPrimary)-Number(a.id===preferido||a.isPrimary)||a.title.localeCompare(b.title));
}
export async function guardarRecordatorio(calendarioId:string,datos:DatosRecordatorio,guardia:string,id?:string) {
  const detalles=datosEvento(datos,guardia);
  const calendario=(await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).find(c=>c.id===calendarioId);
  if(!calendario?.allowsModifications)throw Error('Este calendario no está disponible o es de solo lectura. Seleccione otro.');
  if(id){
    const evento=await Calendar.getEventAsync(id);
    if(evento.calendarId!==calendarioId||!esRecordatorio(evento.notes,guardia))throw Error('Este recordatorio no pertenece a su cuenta.');
    await Calendar.updateEventAsync(id,detalles);return id;
  }
  return Calendar.createEventAsync(calendarioId,detalles);
}
export async function eliminarRecordatorio(id:string,guardia:string) {
  const evento=await Calendar.getEventAsync(id);
  if(!esRecordatorio(evento.notes,guardia))throw Error('Este recordatorio no pertenece a su cuenta.');
  await Calendar.deleteEventAsync(id);
}
