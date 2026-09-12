const stubs = require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/model.ts');
const { ultimoPrecinto } = require('../src/logic.ts');
const dia = require('../src/informedia.ts');
const text = require('../src/text.ts');
const ai = require('../src/ai.ts');
const { construirPDFDia } = require('../src/pdfdia.ts');
const { crearPDF } = require('../src/pdfw.ts');
const { elegirDocumento } = require('../src/lectura.ts');
const jpeg = require('jpeg-js');

const ventana = { fecha: '2026-09-08', corte: '19:00' };
const registro = (id, acceso, hora, tipo = 'apertura') => ({ id, acceso, hora, tipo, fecha: '2026-09-09', p1: '', p2: '', nota: '', updatedAt: 1 });
function estado() {
  const S = model.estadoVacio();
  S.site.cliente = 'Paseo de prueba';
  S.accesses = ['Portón ingreso', 'Portón egreso', 'Portón peatonal'].map((nombre, i) => ({ id: String(i), nombre }));
  return S;
}

test('los cuatro dígitos son del último precinto cargado, no del mayor ni del siguiente', () => {
  const S = estado();
  S.alogs = [{ orden: 1, p1: '9999999' }, { orden: 2, p1: '0012999', p2: '3456001' }];
  assert.equal(ultimoPrecinto(S), '3456001');
  assert.equal(model.prefijoPrecinto(ultimoPrecinto(S)), '3456');
  assert.equal(model.prefijoPrecinto('765249000012345678'), '7652');
  assert.equal(model.armarPrecinto('3456', '007'), '3456007');
  assert.equal(model.armarPrecinto('3456', '8001002'), '8001002');
  assert.equal(model.armarPrecinto('3456', ''), '');
});

test('ventana de 24 horas incluye inicio y excluye fin; corte 00 funciona', () => {
  assert.equal(dia.horaCorte({ site: { corteInforme: '00' } }), '00:00');
  assert.equal(dia.dentro(ventana, '2026-09-08', '19:00'), true);
  assert.equal(dia.dentro(ventana, '2026-09-08', '18:59'), false);
  assert.equal(dia.dentro(ventana, '2026-09-09', '18:59'), true);
  assert.equal(dia.dentro(ventana, '2026-09-09', '19:00'), false);
  assert.equal(dia.dentro(ventana, '2026-09-09', '29:99'), false);
});

test('portones incompletos no afirman que están todos abiertos', () => {
  const S = estado();
  S.alogs = [registro('a', 'Portón ingreso', '04:45'), registro('b', 'Portón egreso', '05:10')];
  assert.equal(dia.entradasDeVentana(S, ventana).length, 2);
  assert.ok(dia.entradasDeVentana(S, ventana).every(e => !e.items && e.categoria==='APERTURA'));
});

test('cada apertura conserva su horario y no duplica el asiento vinculado', () => {
  const S = estado();
  S.alogs = [registro('a', 'Portón ingreso', '07:30'), registro('b', 'Portón egreso', '08:10'),
    registro('c', 'Portón peatonal', '08:15'), registro('e', 'Puerta E8', '08:03'), registro('e2', 'Puerta E2', '08:22')];
  S.novedades = [{ id: 'n', fecha: '2026-09-09', hora: '07:30', alogId: 'a', texto: 'Duplicado' }];
  const entradas = dia.entradasDeVentana(S, ventana);
  assert.deepEqual(entradas.map(e => e.hora), ['07:30','08:03','08:10','08:15','08:22']);
  assert.equal(entradas.filter(e=>e.hora==='07:30').length,1);
  assert.equal(entradas[0].texto, 'Duplicado');
  assert.equal(dia.familiaDe('Puerta E8'), 'emergencia');
});

test('un cierre intermedio impide agrupar una apertura incompleta', () => {
  const S = estado();
  S.alogs = [registro('a', 'Portón ingreso', '07:30'), registro('x', 'Portón ingreso', '07:35', 'cierre'),
    registro('b', 'Portón egreso', '08:10'), registro('c', 'Portón peatonal', '08:15')];
  assert.ok(dia.entradasDeVentana(S, ventana).every(e => !e.items));
});

test('las visitas históricas aparecen una vez aunque no tengan asiento; las bajas se excluyen', () => {
  const S = estado();
  const acc = model.accNormal({ empresa: 'PRUEBA', tarea: 'retirar chatarra' });
  S.visits = [{ id: 'v', acc, tipo: 'Proveedor', fecha: '2026-09-09', horaIn: '09:00' }];
  assert.equal(dia.entradasDeVentana(S, ventana).length, 1);
  S.novedades = [{ id: 'n', visitId: 'v', mov: 'in', fecha: '2026-09-09', hora: '09:00', texto: text.textoIngresoAcceso(acc) }];
  assert.equal(dia.entradasDeVentana(S, ventana).length, 1);
  S.visits[0].deleted = true; S.novedades[0].deleted = true;
  assert.equal(dia.entradasDeVentana(S, ventana).length, 0);
});

test('el cierre considera incidencias, marcas explícitas e informes dentro del período', () => {
  const S = estado();
  assert.equal(dia.hayTrascendentes(S, ventana), false);
  S.novedades = [{ id: 'i', fecha: '2026-09-09', hora: '10:00', categoria: 'Incidencia' }];
  assert.equal(dia.hayTrascendentes(S, ventana), true);
  S.novedades[0].deleted = true;
  assert.equal(dia.hayTrascendentes(S, ventana), false);
  S.reports = [{ fecha: '2026-09-09', hora: '10:00' }];
  assert.equal(dia.hayTrascendentes(S, ventana), true);
});

test('redacción formal y autorización pendiente no afirman un ingreso', () => {
  const acc = model.accNormal({ empresa: 'ACME', tarea: 'retirar chatarra del Libertad', autoriz: 'cctv' });
  assert.match(text.textoIngresoAcceso(acc), /con el fin de retirar chatarra del Libertad/);
  acc.autoriz = 'espera';
  assert.match(text.textoIngresoAcceso(acc), /^Se presenta personal/);
  assert.doesNotMatch(text.textoIngresoAcceso(acc), /a realizar retirar/);
  assert.equal(model.AUTZ.some(a => a[0] === 'admin'), false);
});

test('la revisión de IA rechaza entradas o números faltantes', () => {
  const borrador = dia.textoInformeDia([{ fecha: '2026-09-09', hora: '04:45', texto: 'Se abre el acceso.', items: ['Portón Oroño'] }],
    { site: 'Paseo', fecha: '2026-09-08', cierre: '', fotos: 0 });
  assert.doesNotThrow(() => dia.validarRedaccionDia(borrador, borrador.replace('Se abre', 'Se procede a abrir')));
  assert.throws(() => dia.validarRedaccionDia(borrador, borrador.replace('04:45', '05:45')));
  assert.throws(() => dia.validarRedaccionDia(borrador, borrador.replace('Portón Oroño', 'Portón diferente')));
});

test('cronogramas normalizan horas, conservan francos y rechazan fechas imposibles', () => {
  const filas = ai.parsearCronograma('| fecha | vigilador | tipo | entrada | salida |\n| 2026-09-09 | Pérez Ana | turno | 7:00 | 15:00 |\n2026-09-10 | Pérez Ana | franco | |');
  assert.equal(filas.length, 2); assert.equal(filas[0].entrada, '07:00'); assert.equal(filas[1].entrada, '');
  assert.throws(() => ai.parsearCronograma('2026-02-30 | Pérez | turno | 07:00 | 15:00'));
  assert.throws(() => ai.parsearCronograma('2026-09-09 | Pérez | turno | 29:00 | 15:00'));
  assert.throws(() => ai.parsearCronograma('2026-09-09 | Pérez | turno | | 15:00'));
});

test('directivas omiten encabezados y conservan dígitos de hora y puesto', () => {
  const filas = ai.parsearDirectivasIA('| HH:MM | tarea | detalle | puesto | turno |\n|---|---|---|---|---|\n| 1. 7:45 | Abrir portón | Revisar precinto | Playa 1 | Mañana |\n--:-- | Recorridas | Aleatorias | Paseo | Noche');
  assert.equal(filas.length, 2); assert.equal(filas[0].hora, '07:45'); assert.equal(filas[0].puesto, 'Playa 1');
  assert.equal(filas[1].hora, '');
});

test('el lector PDF funciona sin TextDecoder latin1, incluso con acentos', async () => {
  const Decoder = global.TextDecoder;
  global.TextDecoder = class extends Decoder { constructor(label = 'utf-8') { if (label !== 'utf-8') throw new RangeError('Expo'); super(label); } };
  delete require.cache[require.resolve('../src/pdfr.ts')];
  try {
    const { extraerTextoPDF } = require('../src/pdfr.ts');
    const pdf = crearPDF(); pdf.text('07:45 Apertura portón Oroño. Precinto N° 0012007.');
    const bytes = pdf.build();
    assert.match(await extraerTextoPDF(bytes.buffer), /Apertura portón Oroño/);
  } finally { global.TextDecoder = Decoder; }
});

test('selector: cancelación y rechazo nativo no cierran la aplicación', async () => {
  stubs.picker.getDocumentAsync = async () => { throw new Error('Selector no disponible'); };
  assert.deepEqual(await elegirDocumento(), { clase: 'vacio', motivo: 'Selector no disponible' });
  stubs.picker.getDocumentAsync = async () => ({ canceled: true });
  assert.deepEqual(await elegirDocumento(), { clase: 'vacio', motivo: '' });
});

test('PDF escaneado se entrega como documento para IA y el diagrama conserva su grilla', async () => {
  stubs.bytes = new TextEncoder().encode('%PDF-1.4\n%%EOF');
  stubs.picker.getDocumentAsync = async () => ({ assets: [{ uri: 'file://test.pdf', name: 'diagrama.pdf', mimeType: 'application/pdf' }] });
  const doc = await elegirDocumento({ conservarPDF: true });
  assert.equal(doc.clase, 'pdf'); assert.equal(doc.imagen.mime, 'application/pdf');
});

test('IA migra Gemini retirado, no pone la clave en URL y extrae texto multipart', async () => {
  const previo = global.fetch;
  let pedido;
  global.fetch = async (url, init) => { pedido = { url, ...init }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: 'interno' }, { text: 'Revisión correcta.' }] } }] })); };
  try {
    assert.equal(await ai.pedirIA('Prueba', { proveedor: 'gemini', apiKey: ' test-key ', modelo: 'gemini-2.0-flash', baseUrl: '' }), 'Revisión correcta.');
    assert.match(pedido.url, /gemini-3-flash-preview/); assert.doesNotMatch(pedido.url, /test-key/);
    assert.equal(pedido.headers['x-goog-api-key'], 'test-key');
    global.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'Texto' }] } }] }));
    assert.equal(await ai.pedirIA('P', { proveedor: 'groq', apiKey: 'test-key', modelo: '', baseUrl: '' }), 'Texto');
  } finally { global.fetch = previo; }
});

test('IA rechaza credenciales, límites y respuestas truncadas sin reemplazar un informe', async () => {
  const previo = global.fetch;
  const cfg = { proveedor: 'gemini', apiKey: 'test-key', modelo: '', baseUrl: '' };
  try {
    for (const [status, codigo] of [[401, 'clave'], [429, 'limite'], [404, 'modelo']]) {
      global.fetch = async () => new Response('{}', { status });
      await assert.rejects(ai.pedirIA('P', cfg), e => e.codigo === codigo);
    }
    global.fetch = async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Medio informe' }] } }] }));
    await assert.rejects(ai.pedirIA('P', cfg), e => e.codigo === 'incompleto');
  } finally { global.fetch = previo; }
});

test('PDF usa texto negro y conserva el JPEG de evidencia a color', () => {
  const data = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  const foto = jpeg.encode({ width: 2, height: 2, data }, 80).data;
  const b = construirPDFDia('Site: Paseo\n\nFecha: 08/09/2026\n\nNovedades:\n\n07:00 hs.: Apertura.\n   •   Portón Oroño', [foto]);
  const pdf = Buffer.from(b).toString('latin1');
  assert.match(pdf, /\/DeviceRGB/); assert.ok(Buffer.from(b).includes(foto));
  assert.match(pdf, /BT 0 0 0 rg/); assert.doesNotMatch(pdf, /[1-9][\d.]* [\d.]+ [\d.]+ rg/);
  assert.doesNotMatch(pdf, /INFORME DE NOVEDADES/); assert.match(pdf, /\/Count 1/);
});

test('nacimiento exige una fecha real y no futura', () => {
  assert.equal(model.isoDesdeDmy('31/02/1990'), '');
  assert.equal(model.isoDesdeDmy('01/01/2990'), '');
  assert.equal(model.isoDesdeDmy('24/07/1990'), '1990-07-24');
});

const servicio = require('../src/servicio.ts');
const { aplicarCambios, restaurarRespaldo } = require('../src/mutaciones.ts');
const cuentas = require('../src/cuentas.ts');
const operacion = require('../src/operacion.ts');
function guardias() {
  const S = estado();
  S.posts = [{ id: 'puesto', nombre: 'Playa' }];
  S.franjas = [{ id: 'turno', puestoId: 'puesto', nombre: 'Mañana', entrada: '07:00', salida: '15:00' }];
  const a = { id: 'ana', nombre: 'Ana', apellido: 'Pérez', cuenta: true, legajo: '001', rol: 'admin', puestoId: 'puesto', franjaId: 'turno' };
  const b = { ...a, id: 'bruno', nombre: 'Bruno', apellido: 'Díaz', legajo: '002', rol: 'vigilador' };
  S.guards = [a,b];
  return { S, a, b };
}
const momento = h => new Date('2026-09-09T' + h + ':00');

test('relevo: ambas cuentas comparten el libro, pero sólo el autor edita durante su turno', () => {
  let { S, a, b } = guardias();
  S = aplicarCambios(S, servicio.iniciarServicio(S,a,momento('07:00')), a, true);
  assert.throws(() => servicio.iniciarServicio(S,b,momento('07:01')), /anterior/);
  S = aplicarCambios(S,[{ col:'novedades', obj:{ id:'propia',fecha:'2026-09-09',hora:'08:00',texto:'Control realizado', guardId:b.id }}],a);
  assert.equal(S.novedades.find(n=>n.id==='propia').guardId,b.id);
  assert.equal(S.novedades.find(n=>n.id==='propia').createdBy,a.id);
  const original = JSON.stringify(S);
  assert.throws(()=>aplicarCambios(S,[{col:'recorridos',obj:{id:'no-parcial'}},{col:'novedades',obj:{id:'propia',texto:'Cambio'}}],b),/otro guardia/);
  assert.equal(JSON.stringify(S),original);
  S = aplicarCambios(S,servicio.cerrarServicio(S,a,'Se entrega el puesto.',momento('15:00')),a,true);
  S = aplicarCambios(S,servicio.iniciarServicio(S,b,momento('15:01')),b,true);
  assert.match(servicio.motivoSoloLectura(S,S.novedades.find(n=>n.id==='propia'),a.id),/cerrado/);
  assert.throws(()=>aplicarCambios(S,[{col:'novedades',obj:{id:'propia',deleted:true}}],b),/otro guardia/);
  assert.equal(S.novedades.length,1);
  assert.ok(S.novedades.find(n=>n.id==='propia').lockedAt);
  const respaldo=JSON.parse(JSON.stringify(S));
  respaldo.novedades.find(n=>n.id==='propia').texto='Cambio desde respaldo';
  respaldo.novedades.find(n=>n.id==='propia').updatedAt=Date.now()+100000;
  assert.equal(restaurarRespaldo(S,respaldo,a).novedades.find(n=>n.id==='propia').texto,'Control realizado');
  assert.throws(()=>restaurarRespaldo(S,respaldo,b),/administración/);
});

test('cerrar bloquea cada acceso sin crear novedades adicionales', () => {
  let {S,a}=guardias();S=aplicarCambios(S,servicio.iniciarServicio(S,a,momento('07:00')),a,true);
  S=aplicarCambios(S,S.accesses.map((x,i)=>({col:'alogs',obj:{...registro('a'+i,x.nombre,'07:'+String(30+i)),guardId:a.id}})),a);
  assert.equal(dia.entradasDeVentana(S,ventana).length,3);
  S=aplicarCambios(S,servicio.cerrarServicio(S,a,'',momento('15:00')),a,true);
  assert.equal(S.novedades.length,0);assert.ok(S.alogs.every(x=>x.lockedAt));
  S.accesses.push({id:'nuevo',nombre:'Portón nuevo'});
  assert.equal(dia.entradasDeVentana(S,ventana).length,3);
  S=aplicarCambios(S,servicio.iniciarServicio(S,a,momento('16:00')),a,true);
  assert.throws(()=>aplicarCambios(S,[{col:'alogs',obj:{id:'a0',hora:'08:00'}}],a),/cerrado/);
});
test('las aperturas y cierres se informan a cualquier hora; las bajas se respetan',()=>{
  const S=estado();S.alogs=[registro('a','Portón A','04:30'),registro('b','Portón A','23:00','cierre')];
  const rows=dia.entradasDeVentana(S,ventana);assert.deepEqual(rows.map(x=>x.categoria),['APERTURA']);
  S.alogs[1].hora='12:00';assert.deepEqual(dia.entradasDeVentana(S,ventana).map(x=>x.categoria),['APERTURA','CIERRE']);
  S.novedades=[{id:'baja',autoKey:'acceso:a',deleted:true}];assert.equal(dia.entradasDeVentana(S,ventana).length,1);
});

test('el informe ordena y separa fechas antes y después de medianoche',()=>{
  const S=estado();S.novedades=[
    {id:'b',fecha:'2026-09-09',hora:'00:00',texto:'Segundo día'},
    {id:'a',fecha:'2026-09-08',hora:'23:59',texto:'Primer día'},
    {id:'fuera',fecha:'2026-09-09',hora:'19:00',texto:'Fuera'},
  ];
  const x=dia.textoInformeDia(dia.entradasDeVentana(S,ventana),{site:'Prueba',fecha:ventana.fecha,cierre:'',fotos:0});
  assert.match(x,/Día 08\/09\/2026\n\n23:59 NOVEDAD\nPrimer día\n\nDía 09\/09\/2026\n\n00:00 NOVEDAD\nSegundo día/);
  assert.doesNotMatch(x,/Fuera/);
  assert.throws(()=>dia.validarRedaccionDia(x,x.replace('Día 08/09/2026','Día 09/09/2026')));
});

test('la lectura del libro requiere filas y conserva hora ilegible para revisión',()=>{
  const x=ai.parsearLibroFisico('```json\n[{"fecha":"2026-09-08","hora":"23:55","texto":"Se recibe el puesto."},{"fecha":"2026-09-09","hora":"","texto":"[ilegible]"}]\n```');
  assert.equal(x.length,2);assert.equal(x[1].hora,'');
  assert.throws(()=>ai.parsearLibroFisico('[]'));
  assert.throws(()=>ai.parsearLibroFisico('No puedo leerlo'));
  assert.equal(servicio.fechaValida('2026-02-30'),false);
});

test('WhatsApp prepara el texto y el destinatario sin enviar el mensaje',()=>{
  const texto='Local A & B: cerrado.\nObservación: aún no abrió.';
  const url=new URL(operacion.urlWhatsApp(texto,'+54 341 1234567'));
  assert.equal(url.protocol,'whatsapp:');assert.equal(url.searchParams.get('phone'),'543411234567');assert.equal(url.searchParams.get('text'),texto);
  assert.equal(new URL(operacion.urlWhatsApp(texto)).searchParams.has('phone'),false);
  assert.throws(()=>operacion.urlWhatsApp(texto,'123'));
  const c={nombre:'Local A',previsto:'09:00',hora:'09:10',estado:'cerrado',obs:''};
  assert.equal(operacion.observacionPendiente(c,'apertura'),true);
  assert.equal(operacion.observacionPendiente(c,'cierre'),false);
  assert.equal(operacion.observacionPendiente({...c,obs:'Demora informada'},'apertura'),false);
});

test('las cuentas guardan PIN con sal, verifican y limitan intentos',async()=>{
  await assert.rejects(cuentas.guardarPIN('test','12'));
  await cuentas.guardarPIN('test','123456');
  assert.equal(await cuentas.tienePIN('test'),true);
  assert.equal(stubs.memoria.get('securia.pin.test').includes('123456'),false);
  assert.equal(await cuentas.verificarPIN('test','123456'),true);
  for(let i=0;i<5;i++) assert.equal(await cuentas.verificarPIN('test','000000'),false);
  await assert.rejects(cuentas.verificarPIN('test','123456'),/un minuto/);
  await cuentas.guardarPIN('test','654321');
  assert.equal(await cuentas.verificarPIN('test','654321'),true);
});
