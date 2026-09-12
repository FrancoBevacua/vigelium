require('./register.cjs');
const fs = require('node:fs');
const { construirPDFDia } = require('../src/pdfdia.ts');
const jpeg = require('jpeg-js');
// Evidencia sintética: comprueba la conservación de colores y el espacio reservado.
const width = 640, height = 280, data = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4;
  data[i] = x % 255; data[i + 1] = y % 255; data[i + 2] = 160; data[i + 3] = 255;
}
const imagen = jpeg.encode({ width, height, data }, 80).data;
const {textoInformeDia}=require('../src/informedia.ts');
const ejemplos=[
 ['23:30','RECORRIDO','Se realiza recorrido del paseo. Sin novedades.','2026-09-09'],
 ['06:30','NOVEDAD','Siendo la hora indicada, se informa un hecho de hurto en el local de ejemplo. Se preserva la evidencia y se comunica la situación al supervisor.'],
 ['06:30','ADICIONAL','Ingresa adicional policial Murillo, Jesica. Turno: 09:00-16:00.'],
 ['06:30','INGRESO','Ingresa Gs Roca, Julio al puesto Playa 2. Turno: 10:00-22:00.'],
 ['06:30','EGRESO','Se retira Gs Roca, Julio.'],
 ['07:30','APERTURA','Se procede a la apertura del portón Río Shop.'],
 ['07:35','CIERRE','Se procede al cierre del portón Río Shop.'],
 ['09:10','EXTERNO','Ingresa personal de la firma Giro Metal a realizar trabajos en el techo de Libertad. Autorización previamente confirmada por CCTV.'],
];
const entradas=ejemplos.map(([hora,categoria,texto,fecha],i)=>({clave:String(i),hora,categoria,texto,fecha:fecha||'2026-09-10',firma:'Gs Pérez, Ana',origen:'novedad',ids:[String(i)]}));
const opciones={site:'Libertad Rosario · Ejemplo de formato · Datos ficticios',fecha:'2026-09-09',cierre:'Se informa al supervisor la novedad de trascendencia registrada durante el servicio.',fotos:1};
const texto=textoInformeDia(entradas,opciones);
fs.mkdirSync('output/pdf', { recursive: true });
fs.writeFileSync('output/pdf/VIGELIUM-plantilla-reporte.pdf', construirPDFDia(texto, [imagen]));
fs.mkdirSync('tmp/pdfs', { recursive: true });
const muchas=Array.from({length:40},(_,i)=>({...entradas[i%entradas.length],fecha:'2026-09-10',texto:'Registro de prueba '+i+'. '+ 'Texto extenso de verificación de márgenes y continuidad del informe. '.repeat(i===12?60:5)}));
fs.writeFileSync('tmp/pdfs/informe-extenso.pdf', construirPDFDia(textoInformeDia(muchas,opciones), [imagen,imagen]));
console.log('PDF de ejemplo y paginación generados.');
