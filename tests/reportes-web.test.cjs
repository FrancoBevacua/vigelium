require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {estadoVacio}=require('../src/model.ts');
const movil=require('../src/informedia.ts');
const {construirPDFDia}=require('../src/pdfplantilla.ts');
const {periodoParaDescarga,periodosDeReportes,correspondeAEntrega}=require('../admin/src/periodos.ts');
// Ejecutar el módulo web real; sólo el navegador y la API se sustituyen abajo.
const archivo=path.resolve(__dirname,'../admin/src/reportes.js');
const mod=new Module(archivo,module);mod.filename=archivo;mod.paths=Module._nodeModulePaths(path.dirname(archivo));
mod._compile(ts.transpileModule(fs.readFileSync(archivo,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,archivo);
const {descargarReporte}=mod.exports;

function ejemplo(){
 const S=estadoVacio();S.site.corteInforme='19';S.site.cliente='Servicio de prueba';
 S.novedades=[
  ['antes','2026-09-12','18:59','Fuera del período anterior.'],
  ['inicio','2026-09-12','19:00','Comienza el servicio.'],
  ['noche','2026-09-12','23:50','Recorrido nocturno.'],
  ['madrugada','2026-09-13','00:10','Control de madrugada.'],
  ['tarde','2026-09-13','18:59','Último recorrido del período.'],
  ['siguiente','2026-09-13','19:00','Servicio siguiente.'],
 ].map(([id,fecha,hora,texto])=>({id,fecha,hora,texto,categoria:'Novedad',guardId:'prueba'}));
 S.guards=[{id:'prueba',apellido:'Prueba',nombre:'Vigilador'}];
 return S;
}

test('web: entrega del 13/09 reúne del 12 a las 19 hasta el 13 a las 19 en un período',()=>{
 const S=ejemplo(),v=periodoParaDescarga(S,'2026-09-13');
 assert.deepEqual(v,{fecha:'2026-09-12',corte:'19:00',duracion:24});
 const entradas=movil.entradasDeVentana(S,v);
 assert.deepEqual(entradas.map(e=>e.ids[0]),['inicio','noche','madrugada','tarde']);
 const tarjetas=periodosDeReportes(S,entradas).filter(p=>correspondeAEntrega(p,'2026-09-13'));
 assert.deepEqual(tarjetas,[v]);
});

test('web: filtro de entrega y agrupación preservan los informes guardados de 12 y 24 horas',()=>{
 const S=ejemplo();S.infdias=[
  {id:'dia',fecha:'2026-09-12',desde:'19:00'},
  {id:'noche',fecha:'2026-09-12',desde:'19:00',duracion:12},
  {id:'borrado',fecha:'2026-09-10',desde:'19:00',deleted:true},
 ];
 const tarjetas=periodosDeReportes(S,movil.entradasDeVentana(S,periodoParaDescarga(S,'2026-09-13')));
 assert.equal(tarjetas.length,2);
 assert.ok(tarjetas.every(p=>correspondeAEntrega(p,'2026-09-13')));
 assert.ok(tarjetas.every(p=>!correspondeAEntrega(p,'2026-09-12')));
 assert.equal(periodoParaDescarga(S,'2027-01-01').fecha,'2026-12-31');
});

test('web: la descarga genera un único PDF idéntico al celular con novedades y fotos de ambos días',async t=>{
 const S=ejemplo(),v=periodoParaDescarga(S,'2026-09-13');
 for(const n of S.novedades)n.fotosTotal=1;
 const jpeg=require('jpeg-js').encode({width:1,height:1,data:Buffer.from([0,120,180,255])},90).data;
 const uri='data:image/jpeg;base64,'+jpeg.toString('base64'),pedidos=[];
 t.mock.method(globalThis,'fetch',async (url,op)=>{
  const body=JSON.parse(op.body);assert.equal(body.accion,'foto');pedidos.push(body.id);
  return {ok:true,json:async()=>({foto:uri})};
 });
 let blob,descargas=0;
 t.mock.method(URL,'createObjectURL',b=>{blob=b;return 'blob:prueba';});
 t.mock.method(globalThis,'setTimeout',()=>0);
 const doc=globalThis.document;
 globalThis.document={createElement:tag=>{assert.equal(tag,'a');return {click(){descargas++;assert.match(this.download,/2026-09-12\.pdf$/);}};}};
 t.after(()=>{if(doc===undefined)delete globalThis.document;else globalThis.document=doc;});
 await descargarReporte(S,v);
 assert.equal(descargas,1);
 assert.deepEqual(pedidos,['inicio','noche','madrugada','tarde']);
 const texto=movil.textoInformeDia(movil.entradasDeVentana(S,v),{
  site:S.site.cliente,fecha:v.fecha,cierre:movil.cierrePorDefecto(S,v),fotos:1,ventana:v,
 });
 assert.match(texto,/12\/09\/2026 19:00 a 13\/09\/2026 19:00 · 24 horas/);
 const pdf=new Uint8Array(await blob.arrayBuffer());
 assert.deepEqual(pdf,construirPDFDia(texto,[jpeg]));
 if(process.env.VIGELIUM_PDF_QA){fs.mkdirSync(path.dirname(process.env.VIGELIUM_PDF_QA),{recursive:true});fs.writeFileSync(process.env.VIGELIUM_PDF_QA,pdf);}
});
