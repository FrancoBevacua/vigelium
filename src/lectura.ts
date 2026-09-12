/* Lectura local con selección y cancelación protegidas en Android y web. */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { extraerTextoPDF } from './pdfr';
import { ImagenIA } from './ai';
import { leerBytes, bytesBase64, prepararFoto } from './media';

export type Documento =
  | { clase: 'texto'; texto: string; nombre: string }
  | { clase: 'imagen' | 'pdf'; imagen: ImagenIA; nombre: string; uri?: string }
  | { clase: 'vacio'; motivo: string };

let selectorAbierto = false;
const LIMITE = 12 * 1024 * 1024;

export async function elegirDocumento(opciones: { conservarPDF?: boolean } = {}): Promise<Documento> {
  if (selectorAbierto) return { clase: 'vacio', motivo: '' };
  selectorAbierto = true;
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'image/*'], copyToCacheDirectory: true, multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return { clase: 'vacio', motivo: '' };
    const a = res.assets[0];
    const nombre = a.name || 'documento';
    if ((a.size || 0) > LIMITE) throw new Error('El documento supera los 12 MB. Dividilo en archivos más pequeños.');
    if (a.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|hei[cf])$/i.test(nombre)) {
      const foto = await prepararFoto(a.uri, 2200);
      return { clase: 'imagen', nombre, uri: foto.uri, imagen: { mime: 'image/jpeg', base64: foto.base64! } };
    }
    const bytes = await leerBytes(a.uri);
    if (bytes.length > LIMITE) throw new Error('El documento supera los 12 MB.');
    if (/\.txt$/i.test(nombre) || a.mimeType === 'text/plain') {
      return { clase: 'texto', texto: new TextDecoder().decode(bytes), nombre };
    }
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('El archivo no es un PDF válido.');
    if (!opciones.conservarPDF) {
      try {
        const crudo = await extraerTextoPDF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
        if (crudo?.trim().length >= 20) return { clase: 'texto', texto: crudo, nombre };
      } catch { /* Un PDF sin capa legible se interpreta como documento completo. */ }
    }
    return { clase: 'pdf', nombre, imagen: { mime: 'application/pdf', base64: bytesBase64(bytes) } };
  } catch (e: any) {
    return { clase: 'vacio', motivo: e?.message || 'No se pudo abrir el archivo. Probá de nuevo o pegá el texto.' };
  } finally { selectorAbierto = false; }
}

export async function elegirFotoDocumento(camara: boolean): Promise<Documento> {
  if (selectorAbierto) return { clase: 'vacio', motivo: '' };
  selectorAbierto = true;
  try {
    const permiso = camara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return { clase: 'vacio', motivo: 'Hace falta permiso para usar la cámara o la galería.' };
    const res = camara ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (res.canceled || !res.assets?.[0]) return { clase: 'vacio', motivo: '' };
    const a = res.assets[0];
    const foto = await prepararFoto(a.uri, 2200);
    return { clase: 'imagen', nombre: a.fileName || 'foto', uri: foto.uri, imagen: { mime: 'image/jpeg', base64: foto.base64! } };
  } catch (e: any) {
    return { clase: 'vacio', motivo: e?.message || 'No se pudo abrir la cámara o la galería.' };
  } finally { selectorAbierto = false; }
}
