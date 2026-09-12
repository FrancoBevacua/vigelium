require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../src/ai.ts');
const { dividirDocumento, interpretarDocumento } = require('../src/importacionIA.ts');
const { dniNormal, dniValido } = require('../src/cuentas.ts');
const { aplicarCambios } = require('../src/mutaciones.ts');
const { estadoVacio } = require('../src/model.ts');
const { textoRecorrido } = require('../src/operacion.ts');
const cfg = { proveedor: 'gemini', apiKey: 'test-key', modelo: 'gemini-flash-3.0 free', baseUrl: '' };
const respuesta = text => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));

test('DNI normalizado, válido y único; dos cuentas no necesitan legajo', () => {
  assert.equal(dniNormal(' 12.345.678 '), '12345678');
  for (const dni of ['1234567', '12.345.678']) assert.ok(dniValido(dni));
  for (const dni of ['123456', '123456789', '00000000', '1234A678']) assert.equal(dniValido(dni), false);
  const uno = { id:'a', cuenta:true, dni:'12345678', legajo:'' };
  let S = aplicarCambios(estadoVacio(), [{col:'guards', obj:uno}], null);
  S = aplicarCambios(S, [{col:'guards', obj:{...uno,id:'b',dni:'23456789'}}], null);
  assert.equal(S.guards.length, 2);
  assert.throws(() => aplicarCambios(S, [{col:'guards',obj:{...uno,id:'c',dni:'12.345.678'}}], null), /DNI/);
});

test('el recorrido no requiere catálogo y conserva observaciones sin inventar controles', () => {
  for (const [tipo, palabra] of [['apertura','abiertos'],['cierre','cerrados']]) {
    const s = textoRecorrido({tipo,fecha:'2026-09-09',hora:'09:00',controles:[],observaciones:'Un local permanece cerrado.'}, '');
    assert.ok(s.startsWith('Recorrido para el control de locales '+palabra+'.'));
    assert.match(s, /Un local permanece cerrado/); assert.doesNotMatch(s, /•/);
  }
});

test('documento mayor a 80 mil caracteres conserva todas las líneas al dividirse internamente', () => {
  const lineas = Array.from({length:3000}, (_,i)=>'Puesto y directiva número '+i+' con descripción completa.');
  const texto = lineas.join('\n');
  const partes = dividirDocumento(texto);
  assert.ok(texto.length > 80000); assert.ok(partes.every(p=>p.length<=24001));
  for (const linea of lineas) assert.ok(partes.some(p=>p.includes(linea)), linea);
});

test('IA lee todas las partes, transmite contexto y evita directivas duplicadas', async () => {
  const previo = global.fetch;
  const texto = 'Una directiva de prueba para el puesto Playa.\n'.repeat(2100);
  const partes = dividirDocumento(texto); const solicitudes=[];
  global.fetch = async (url, init) => {
    solicitudes.push(JSON.parse(init.body));
    assert.match(init.body, /respondé exactamente: Sin directivas/);
    assert.match(url, /gemini-3-flash-preview/);
    return respuesta(solicitudes.length===1 ? 'Sin directivas.' : '07:30 | Abrir | Revisar precinto | Playa | Mañana');
  };
  try {
    const filas = await interpretarDocumento(texto,['Playa'],['Mañana'],cfg);
    assert.equal(solicitudes.length,partes.length); assert.equal(filas.length,1);
    assert.match(JSON.stringify(solicitudes[2]), /Contexto de continuidad/);
  } finally { global.fetch=previo; }
});

test('una parte fallida o cancelada no entrega una importación parcial', async () => {
  const previo=global.fetch; let n=0;
  global.fetch=async()=> ++n===1 ? respuesta('07:30 | Abrir | | Playa | Mañana') : new Response('{}',{status:429});
  try {
    await assert.rejects(interpretarDocumento('directiva de apertura\n'.repeat(3000),[],[],cfg), e=>e.codigo==='limite');
    assert.equal(n,2);
    await assert.rejects(interpretarDocumento('texto',[],[],cfg,undefined,undefined,()=>false),/cancelada/);
    assert.equal(n,2);
  } finally {global.fetch=previo;}
});

test('Gemini recibe el audio M4A y su modelo canónico sin exponer la key en URL', async () => {
  const previo=global.fetch; let pedido;
  global.fetch=async(url,init)=>{pedido={url,...init};return respuesta('Se recibe el puesto sin novedades.');};
  try {
    assert.equal(await ai.transcribirAudio({uri:'file://prueba.m4a',mime:'audio/mp4',nombre:'prueba.m4a',base64:'AAAA'},cfg),'Se recibe el puesto sin novedades.');
    assert.match(pedido.url,/gemini-3-flash-preview/); assert.doesNotMatch(pedido.url,/test-key/);
    assert.match(pedido.body,/audio\/mp4/); assert.match(pedido.body,/AAAA/);
  } finally {global.fetch=previo;}
});
