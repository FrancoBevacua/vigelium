require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const load=Module._load;let lectura=false,creados=0,actualizados=0,borrados=0,notas='';
const calendario={id:'google',allowsModifications:true,createEvent:async d=>{creados++;notas=d.notes;return{id:'evento'};}};
const evento={id:'evento',calendarId:'google',get notes(){return notas;},update:async d=>{actualizados++;notas=d.notes;},delete:async()=>{borrados++;}};
Module._load=function(n,...a){if(n==='expo-calendar/legacy')return {EntityTypes:{EVENT:'event'},AlarmMethod:{ALERT:'alert'},getCalendarsAsync:async()=>[{id:'solo-lectura',title:'Feriados',allowsModifications:false},{id:'local',title:'Local',allowsModifications:true},{id:'google',title:'Google',isPrimary:true,allowsModifications:!lectura}],getEventAsync:async()=>evento,createEventAsync:async(id,d)=>{assert.equal(id,'google');assert.equal(d.alarms[0].method,'alert');return (await calendario.createEvent(d)).id;},updateEventAsync:async(id,d)=>evento.update(d),deleteEventAsync:async()=>evento.delete()};return load.call(this,n,...a);};
const {datosEvento,calendariosDisponibles,guardarRecordatorio,eliminarRecordatorio,esRecordatorio}=require('../src/recordatorios.ts');
const datos={titulo:' Entregar informe ',notas:'Revisar novedades',fecha:'2026-09-14',hora:'19:00',minutosAviso:15};
test('crea un evento a hora local con alarma, edita el mismo ID y refleja su baja',async()=>{
 const id=await guardarRecordatorio('google',datos,'guardia');assert.equal(id,'evento');assert.equal(creados,1);assert.ok(esRecordatorio(notas,'guardia'));
 await guardarRecordatorio('google',{...datos,hora:'07:00'},'guardia',id);assert.equal(creados,1);assert.equal(actualizados,1);
 await eliminarRecordatorio(id,'guardia');assert.equal(borrados,1);
 const e=datosEvento(datos,'guardia');assert.equal(e.startDate.getHours(),19);assert.equal(e.endDate-e.startDate,15*60000);assert.equal(e.alarms[0].relativeOffset,-15);
});
test('filtra calendarios de solo lectura y prioriza el principal disponible',async()=>{
 assert.deepEqual((await calendariosDisponibles()).map(c=>c.id),['google','local']);
 lectura=true;await assert.rejects(guardarRecordatorio('google',datos,'guardia'),/solo lectura/);lectura=false;
});
test('no modifica eventos de otros guardias ni eventos ajenos a VIGELIUM',async()=>{
 for(const valor of ['evento privado','[VIGELIUM:recordatorio:otro]']){notas=valor;await assert.rejects(guardarRecordatorio('google',datos,'guardia','evento'),/pertenece/);await assert.rejects(eliminarRecordatorio('evento','guardia'),/pertenece/);}
});
test('rechaza datos incompletos y fechas inválidas antes de llamar al calendario',()=>{
 for(const cambio of [{titulo:''},{fecha:'2026-02-30'},{hora:'25:00'},{minutosAviso:7}])assert.throws(()=>datosEvento({...datos,...cambio},'guardia'));
});
