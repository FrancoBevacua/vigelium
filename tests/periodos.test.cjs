require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ventanaParaEntrega,ventanaReciente,dentro,limites,horaFin,entradasDeVentana,textoInformeDia,cierrePorDefecto}=require('../src/informedia.ts');
const {estadoVacio}=require('../src/model.ts');
test('19 a 19 calcula ayer desde la fecha de entrega y respeta los extremos',()=>{
 const v=ventanaParaEntrega('2026-09-14','19:00',24);assert.equal(v.fecha,'2026-09-13');
 for(const [f,h,ok] of [['2026-09-13','18:59',false],['2026-09-13','19:00',true],['2026-09-14','00:00',true],['2026-09-14','18:59',true],['2026-09-14','19:00',false]])assert.equal(dentro(v,f,h),ok);
});
test('12 horas diurnas y nocturnas no pierden ni duplican novedades en el relevo',()=>{
 const dia=ventanaParaEntrega('2026-09-14','07:00',12),noche=ventanaParaEntrega('2026-09-15','19:00',12);
 assert.equal(dia.fecha,'2026-09-14');assert.equal(noche.fecha,'2026-09-14');assert.equal(horaFin(noche),'07:00');
 assert.equal(dentro(dia,'2026-09-14','19:00'),false);assert.equal(dentro(noche,'2026-09-14','19:00'),true);
 assert.equal(dentro(dia,'2026-09-14','23:00'),false);assert.equal(dentro(noche,'2026-09-15','07:00'),false);
 const s=estadoVacio();s.novedades=[['06:59','fuera'],['07:00','entrada'],['18:59','fin'],['19:00','noche']].map(([hora,id])=>({id,fecha:'2026-09-14',hora,texto:id}));
 assert.deepEqual(entradasDeVentana(s,dia).map(e=>e.texto),['entrada','fin']);
});
test('cambios de mes y año, medianoche y último período finalizado',()=>{
 assert.equal(ventanaParaEntrega('2026-01-01','19:00',24).fecha,'2025-12-31');
 assert.equal(ventanaParaEntrega('2024-03-01','19:00',12).fecha,'2024-02-29');
 assert.equal(limites(ventanaParaEntrega('2026-09-14','12:00',12)).hasta.min,0);
 assert.equal(ventanaReciente('19:00',24,true,new Date(2026,8,14,18,59)).fecha,'2026-09-12');
 assert.equal(ventanaReciente('19:00',24,true,new Date(2026,8,14,19,0)).fecha,'2026-09-13');
});
test('el texto y el cierre incluyen el período real de 12 horas',()=>{
 const s=estadoVacio(),v=ventanaParaEntrega('2026-09-14','19:00',12);
 const texto=textoInformeDia([],{site:'Prueba',fecha:v.fecha,cierre:cierrePorDefecto(s,v),fotos:0,ventana:v});
 assert.match(texto,/13\/09\/2026 19:00 a 14\/09\/2026 07:00 · 12 horas/);assert.match(texto,/hasta las 07:00/);
});
