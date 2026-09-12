import {crearPDF,jpegSize} from './pdfw';
import {TITULO_REPORTE} from './reporte';
/** Plantilla del supervisor: asientos con categoría y firma; texto negro. */
export function construirPDFDia(texto:string,fotos:Uint8Array[]=[]):Uint8Array{
 const d=crearPDF({margin:48,footer:'© 2026 Franco Daniel Bevacua · VIGELIUM · Todos los derechos reservados.'});
 const filas=texto.split('\n');const bloques:string[]=[];
 for(let i=0;i<filas.length;i++){
   const l=filas[i].trim();if(!l)continue;
   if(/^\d{2}:\d{2} [A-ZÁÉÍÓÚ/]+$/.test(l)){
     const grupo=[l];while(i+1<filas.length){const siguiente=filas[i+1].trim();
       if(/^\d{2}:\d{2} [A-ZÁÉÍÓÚ/]+$/.test(siguiente)||/^Día \d/.test(siguiente))break;
       i++;grupo.push(siguiente);if(/^Gs\s/.test(siguiente))break;
     }bloques.push(grupo.join('\n'));
   }else bloques.push(l);
 }
 d.text(TITULO_REPORTE,{size:18,bold:true,lead:23});
 for(const bloque of bloques){
  let lineas=bloque.split('\n').map(l=>l.trim()).filter(Boolean);
  if(lineas[0]===TITULO_REPORTE){lineas=lineas.slice(1);if(lineas.length)d.text(lineas.join('\n'),{size:10,lead:14});continue;}
  if(/^Fecha:/.test(bloque)){d.text(bloque,{size:10,lead:15});continue;}
  if(bloque==='Novedades:'){d.band(2,'0 0 0');continue;}
  if(/^Día \d{2}\/\d{2}\/\d{4}$/.test(bloque)){d.keepTogether(65);d.text(bloque,{size:10,bold:true});d.space(7);continue;}
  if(/^\d{2}:\d{2} [A-ZÁÉÍÓÚ/]+$/.test(lineas[0])){
   const titulo=lineas.shift()!;const firma=lineas.length && /^Gs\s/.test(lineas[lineas.length-1])?lineas.pop()!:'';
   const cuerpo=lineas.join('\n');d.keepTogether(d.measureText(cuerpo,10.5,false,14.5)+43);
   d.text(titulo,{size:9.5,bold:true,lead:15});d.text(cuerpo,{size:10.5,lead:14.5});
   if(firma)d.text(firma,{size:8.5,lead:13});d.space(8);
  }else{d.text(bloque,{size:10.5,lead:14.5});d.space(8);}
 }
 if(fotos.length){const s=jpegSize(fotos[0]);if(!s)throw Error('No se pudo preparar una imagen de evidencia.');d.keepTogether(Math.min(420/s.w,350/s.h)*s.h+45);d.text('EVIDENCIA FOTOGRÁFICA',{size:10,bold:true});d.space(8);}
 for(const foto of fotos){const s=jpegSize(foto);if(!s)throw Error('No se pudo preparar una imagen de evidencia.');d.image(foto,s.w,s.h,{width:420,maxHeight:350,color:true});d.space(8);}
 return d.build();
}
