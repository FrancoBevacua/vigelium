import {entradasDeVentana,horaCorte,textoInformeDia,cierrePorDefecto,hayTrascendentes} from '../shared/informedia';
import {construirPDFDia} from '../shared/pdfplantilla';
import {nombreArchivoReporte} from '../shared/reporte';
import {api} from './api';
export async function descargarReporte(S,fecha){
 const corte=horaCorte(S),ventana={fecha,corte},entradas=entradasDeVentana(S,ventana);
 const guardado=S.infdias.find(x=>!x.deleted&&x.fecha===fecha&&x.desde===corte);
 const registros=entradas.filter(e=>e.origen==='novedad').map(e=>({col:'novedades',r:S.novedades.find(n=>n.id===e.ids[0])}));
 if(guardado)registros.push({col:'infdias',r:guardado});
 const fotos=[];for(const {col,r} of registros)for(let i=0;i<(r?.fotosTotal||0);i++){
  const {foto}=await api('foto',{col,id:r.id,indice:i});if(!foto)throw Error('No se pudo recuperar una evidencia.');if(!fotos.includes(foto))fotos.push(foto);
 }
 const defecto=cierrePorDefecto(S,ventana),incidencias=hayTrascendentes(S,ventana)||guardado?.trascendentes;
 const cierre=guardado?.cierre&&guardado.cierre!==defecto?guardado.cierre:incidencias?'':defecto;
 const borrador=textoInformeDia(entradas,{site:S.site.cliente,fecha,cierre,fotos:fotos.length});
 const texto=guardado?.fuente===borrador&&guardado?.texto?guardado.texto:borrador;
 const bytes=[];for(const uri of fotos)bytes.push(await jpeg(uri));
 const pdf=construirPDFDia(texto,bytes);const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
 const a=document.createElement('a');a.href=url;a.download=nombreArchivoReporte(fecha);a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function jpeg(uri){
 if(!/^data:image\//.test(uri))throw Error('Formato de evidencia no disponible.');
 if(uri.startsWith('data:image/jpeg;'))return Uint8Array.from(atob(uri.split(',')[1]),c=>c.charCodeAt(0));
 const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=uri;});const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0);return Uint8Array.from(atob(c.toDataURL('image/jpeg',.9).split(',')[1]),c=>c.charCodeAt(0));
}
