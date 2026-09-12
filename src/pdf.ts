/* Generación y entrega de PDF en el dispositivo.
   Los informes salen en blanco y negro: se imprimen, se mandan por WhatsApp y
   se archivan, y el color no aporta nada en ese recorrido. */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { crearPDF, jpegSize } from './pdfw';
import { construirPDFDia } from './pdfdia';
import { nombreArchivoReporte, numeroSupervisor, TITULO_REPORTE } from './reporte';
import { leerBytes, prepararFoto } from './media';
import { Estado, Informe, Novedad, AccesoLog, isoDate, dmy, hhmm, DOW, parseISO, toMin, addDays } from './model';
import { gsName, resumenAcceso, LBL, textoReporte, textoInformeAccesos, OpcInforme } from './text';

export async function bytesDeFoto(uri: string): Promise<Uint8Array | null> {
  try {
    const foto = await prepararFoto(uri, 1400);
    return await leerBytes(foto.uri);
  } catch {
    throw new Error('No se pudo leer una imagen de evidencia. Vuelva a adjuntarla antes de exportar.');
  }
}

export async function entregarPDF(nombre: string, bytes: Uint8Array): Promise<'compartido' | 'guardado' | 'no'> {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return 'guardado';
    } catch { return 'no'; }
  }
  const f = new File(Paths.cache, nombre);
  try { if (f.exists) f.delete(); } catch { }
  f.create();
  f.write(bytes);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(f.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: nombre });
    return 'compartido';
  }
  return 'guardado';
}

/* Escala de grises: negro para el texto, gris para lo accesorio. */
const NEGRO = '0 0 0';
const GRIS = '0.38 0.38 0.38';
const GRIS_CLARO = '0.55 0.55 0.55';
const LINEA = '0.75 0.75 0.75';

const PIE = (S: Estado, quien: string) =>
  'Generado con VIGELIUM el ' + dmy(isoDate()) + ' a las ' + hhmm() + ' por ' + quien;

/* ---------- informe de seguridad ---------- */
export async function pdfInforme(r: Informe, S: Estado, quien: string) {
  const d = crearPDF();
  d.text('INFORME DE SEGURIDAD', { size: 19, bold: true });
  d.text((S.site.nombre || S.site.cliente || '').toUpperCase(), { size: 12, bold: true, color: NEGRO });
  d.text(((r as any).f4 || 'Sin tipificar') + '  ·  Criticidad ' + ((r as any).f5 || '—') +
    '  ·  ' + ((r as any).f3 || dmy(r.fecha)) + (r.hora ? ' ' + r.hora + ' hs' : ''),
    { size: 10, color: GRIS });
  d.band(2, NEGRO);
  const fotos = r.fotos || [];
  if (fotos.length) {
    const b = await bytesDeFoto(fotos[0]);
    if (b) { const sz = jpegSize(b); if (sz) d.image(b, sz.w, sz.h, { maxHeight: 250 }); }
  }
  for (let i = 1; i <= 16; i++) {
    let v = (((r as any)['f' + i] || '') as string).trim();
    if (i === 3 && r.hora && v) v = v + ' - ' + r.hora + ' hs';
    if (i === 15 && fotos.length) {
      v = (v ? v + '\n' : '') + 'Registro fotográfico: ' + fotos.length + ' imagen' +
        (fotos.length > 1 ? 'es' : '') + ' adjunta' + (fotos.length > 1 ? 's' : '') + '.';
    }
    d.text(i + '. ' + LBL[i - 1].toUpperCase(), { size: 9, bold: true, color: NEGRO });
    d.text(v || 'N/A', { size: 10.5, indent: 8 });
    d.space(6);
  }
  if (fotos.length > 1) {
    d.newPage();
    d.text('EVIDENCIA FOTOGRÁFICA', { size: 15, bold: true });
    d.band(2, NEGRO);
    for (let i = 1; i < fotos.length; i++) {
      const b = await bytesDeFoto(fotos[i]);
      if (!b) continue;
      const sz = jpegSize(b);
      if (!sz) continue;
      d.text('Imagen ' + (i + 1) + ' de ' + fotos.length, { size: 9, bold: true, color: GRIS });
      d.image(b, sz.w, sz.h, { maxHeight: 300 });
      d.space(4);
    }
  }
  d.space(6); d.rule(LINEA);
  d.text(PIE(S, quien), { size: 8, color: GRIS_CLARO });
  const nom = 'informe-' + (r.fecha || isoDate()) + '-' +
    (((r as any).f4 || 'seguridad') as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28) + '.pdf';
  return entregarPDF(nom, d.build());
}

/* ---------- Informe general del día ---------- */
export async function pdfLibro(rows: Novedad[], fecha: string, S: Estado, quien: string, nombreDe: (id: string) => string) {
  const d = crearPDF();
  d.text('LIBRO DE NOVEDADES', { size: 19, bold: true });
  d.text((S.site.cliente || 'Puesto') + (S.site.region ? '  ·  Región ' + S.site.region : ''), { size: 10, color: GRIS });
  d.text(DOW[parseISO(fecha).getDay()] + ' ' + dmy(fecha) + '  ·  ' + rows.length + ' asientos', { size: 10, color: GRIS });
  d.band(2, NEGRO);
  if (!rows.length) d.text('Sin asientos registrados.', { size: 11 });
  rows.forEach(n => {
    const acc = resumenAcceso(n);
    d.text(n.hora + '   ' + (n.categoria || 'NOVEDAD').toUpperCase(), { size: 9.5, bold: true, color: NEGRO });
    if (acc) d.text(acc, { size: 9.5, bold: true, color: GRIS });
    d.text(n.texto, { size: 10.5 });
    d.text(nombreDe(n.guardId), { size: 8.5, color: GRIS_CLARO });
    d.space(7);
  });
  d.space(6); d.rule(LINEA);
  d.text(PIE(S, quien), { size: 8, color: GRIS_CLARO });
  return entregarPDF('libro-novedades-' + fecha + '.pdf', d.build());
}

/* ---------- aperturas y cierres ---------- */
export async function pdfAccesos(rows: AccesoLog[], fecha: string, o: OpcInforme, S: Estado, quien: string) {
  const d = crearPDF();
  const et = o.tipo === 'ambos' ? 'APERTURAS Y CIERRES' : o.tipo === 'apertura' ? 'APERTURAS' : 'CIERRES';
  d.text(et, { size: 19, bold: true });
  d.text((S.site.cliente || '') + '  ·  ' + dmy(fecha), { size: 10, color: GRIS });
  d.band(2, NEGRO);
  textoInformeAccesos(rows, fecha, { ...o, encabezado: false }, S.site).split('\n\n').forEach(bl => {
    const ls = bl.split('\n');
    if (!ls[0]) return;
    d.text(ls[0], { size: 10.5, bold: true });
    ls.slice(1).forEach(l => d.text(l, { size: 10.5, indent: 8 }));
    d.space(7);
  });
  d.space(6); d.rule(LINEA);
  d.text(PIE(S, quien), { size: 8, color: GRIS_CLARO });
  return entregarPDF('accesos-' + fecha + '.pdf', d.build());
}


/* ---------- informe general de las 24 horas ---------- */
export async function pdfInformeDia(
  r: { fecha: string; corte: string; cierre: string; fotos: string[]; texto: string },
  S: Estado,
  quien: string,
  supervisor?: string,
) {
  const fotos: Uint8Array[] = [];
  for (const uri of r.fotos || []) {
    const bytes = await bytesDeFoto(uri);
    if (bytes) fotos.push(bytes);
  }
  const nombre=nombreArchivoReporte(r.fecha),bytes=construirPDFDia(r.texto,fotos);
  if(supervisor!==undefined){
    const numero=numeroSupervisor(supervisor);
    if(Platform.OS!=='android')throw new Error('La entrega directa por WhatsApp está disponible en Android. Utilice Exportar PDF en este dispositivo.');
    const f=new File(Paths.cache,nombre);if(f.exists)f.delete();f.create();f.write(bytes);
    const {default:Share,Social}=await import('react-native-share');
    const opciones:import('react-native-share').ShareSingleOptions & {whatsAppNumber:string}={social:Social.Whatsapp,url:f.uri,type:'application/pdf',title:TITULO_REPORTE,whatsAppNumber:numero};
    try{await Share.shareSingle(opciones);return 'compartido' as const;}
    catch(e:any){throw new Error('No se completó la entrega a WhatsApp. Verifique que esté instalado o utilice Exportar PDF.');}
  }
  return entregarPDF(nombre,bytes);
}
